struct TileData {
    fg_color: u32,
    bg_color: u32,
    char: u32,
    boundary: u32,
    kind: u32,
    has_mask: u32,
    mask_fg: u32,
    mask_bg: u32,
    mask_char: u32,
    mask_kind: u32,
}

struct ColorData {
    close: u32,
    far: u32,
    super_far: u32,
}

struct LightSource {
    x: f32,
    y: f32,
    radius: f32,
    color: u32,
    intensity: f32,
}

struct RenderParams {
    player_x: f32,
    player_y: f32,
    viewport_x: i32,
    viewport_y: i32,
    viewport_width: u32,
    viewport_height: u32,
    view_radius: f32,
    dither_radius: f32,
    super_far_radius: f32,
    steps: u32,
    light_count: u32,
}

struct PixelOutput {
    char: u32,
    fg_color: u32,
    bg_color: u32,
}

@group(0) @binding(0) var<storage, read> tiles: array<TileData>;
@group(0) @binding(1) var<storage, read> colors: array<ColorData>;
@group(0) @binding(2) var<uniform> params: RenderParams;
@group(0) @binding(3) var<storage, read_write> output: array<PixelOutput>;
@group(0) @binding(4) var<storage, read> light_sources: array<LightSource>;

fn hex_to_rgb(hex: u32) -> vec3<f32> {
    let r = f32((hex >> 16u) & 0xFFu) / 255.0;
    let g = f32((hex >> 8u) & 0xFFu) / 255.0;
    let b = f32(hex & 0xFFu) / 255.0;
    return vec3<f32>(r, g, b);
}

fn rgb_to_hex(rgb: vec3<f32>) -> u32 {
    let r = u32(clamp(rgb.r * 255.0, 0.0, 255.0));
    let g = u32(clamp(rgb.g * 255.0, 0.0, 255.0));
    let b = u32(clamp(rgb.b * 255.0, 0.0, 255.0));
    return (r << 16u) | (g << 8u) | b;
}

fn interpolate_color(color1: vec3<f32>, color2: vec3<f32>, factor: f32) -> vec3<f32> {
    return color1 + (color2 - color1) * clamp(factor, 0.0, 1.0);
}

fn dither(total_dist: f32, hi_dist: f32, dith_dist: f32, steps: u32, start: vec3<f32>, end: vec3<f32>) -> vec3<f32> {
    let factor = (total_dist - hi_dist) / dith_dist;
    let step = min(u32(floor(factor * f32(steps))), steps - 1u);
    let start_interp = interpolate_color(start, end, f32(step) / f32(steps));
    let end_interp = interpolate_color(start, end, f32(step + 1u) / f32(steps));
    return interpolate_color(start_interp, end_interp, factor * f32(steps) - f32(step));
}

fn calculate_light_contribution(world_x: f32, world_y: f32, base_color: vec3<f32>) -> vec3<f32> {
    var final_color = base_color;
    
    // Process each light source
    for (var i = 0u; i < params.light_count; i = i + 1u) {
        let light = light_sources[i];
        let light_dx = world_x - light.x;
        let light_dy = world_y - light.y;
        let light_dist = sqrt(light_dx * light_dx + light_dy * light_dy);
        
        // Only apply light if within radius
        if light_dist <= light.radius {
            let light_color = hex_to_rgb(light.color);
            let light_falloff = 1.0 - (light_dist / light.radius);
            let light_strength = light.intensity * light_falloff * light_falloff; // Quadratic falloff
            
            // Blend light color with base color
            final_color = interpolate_color(final_color, light_color, light_strength * 0.5);
        }
    }

    return final_color;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let sx = global_id.x;
    let sy = global_id.y;
    
    // Use dynamic dimensions
    if sx >= params.viewport_width || sy >= params.viewport_height {
        return;
    }

    let wx = f32(i32(sx) + params.viewport_x);
    let wy = f32(i32(sy) + params.viewport_y);
    
    // Use dynamic width for indexing
    let tile_index = sy * params.viewport_width + sx;
    let tile = tiles[tile_index];

    let dx = wx - params.player_x;
    let dy = wy - params.player_y;
    let dist = sqrt(dx * dx + dy * dy);

    var color_kind = tile.kind;
    if tile.has_mask != 0u {
        color_kind = tile.mask_kind;
    }
    
    // Ensure color_kind is within bounds
    if color_kind >= 9u {
        color_kind = 0u;
    }

    let cols = colors[color_kind];
    let close_color = hex_to_rgb(cols.close);
    let far_color = hex_to_rgb(cols.far);
    let super_far_color = hex_to_rgb(cols.super_far);

    var fg_rgb: vec3<f32>;

    if dist <= params.view_radius {
        fg_rgb = close_color;
    } else if dist <= params.view_radius + params.dither_radius {
        fg_rgb = dither(dist, params.view_radius, params.dither_radius, params.steps, close_color, far_color);
    } else if dist <= params.super_far_radius {
        let factor = (dist - (params.view_radius + params.dither_radius)) / (params.super_far_radius - params.view_radius - params.dither_radius);
        fg_rgb = interpolate_color(far_color, super_far_color, factor);
    } else {
        fg_rgb = super_far_color;
    }
    
    // Apply light contributions
    fg_rgb = calculate_light_contribution(wx, wy, fg_rgb);

    var char_to_use = tile.char;
    var bg_to_use = tile.bg_color;

    if tile.has_mask != 0u {
        char_to_use = tile.mask_char;
        if tile.mask_bg != 0u {
            bg_to_use = tile.mask_bg;
        }
    }

    output[tile_index] = PixelOutput(
        char_to_use,
        rgb_to_hex(fg_rgb),
        bg_to_use
    );
}
