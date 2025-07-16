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
    neutral_percentage: f32, // 0 = full natural color, 1 = full light color, 0.5 = 50/50 blend
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

fn calculate_light_contribution(world_x: f32, world_y: f32, base_color: vec3<f32>, tile_kind: u32, has_mask: u32, mask_kind: u32) -> vec3<f32> {
    // If no lights, return the distance-based color unchanged
    if params.light_count == 0u {
        return base_color;
    }
    
    // Check if any light affects this tile
    var has_light_influence = false;
    for (var i = 0u; i < params.light_count; i = i + 1u) {
        let light = light_sources[i];
        let light_dx = world_x - light.x;
        let light_dy = world_y - light.y;
        let light_dist = sqrt(light_dx * light_dx + light_dy * light_dy);
        if light_dist <= light.radius {
            has_light_influence = true;
            break;
        }
    }
    
    // If no lights affect this tile, return original distance-based color
    if !has_light_influence {
        return base_color;
    }
    
    // Get the tile's bright "close" color
    var kind_to_use = tile_kind;
    if has_mask != 0u {
        kind_to_use = mask_kind;
    }
    let tile_close_color = hex_to_rgb(colors[kind_to_use].close);

    var result_color = base_color;
    var max_light_influence = 0.0;
    
    // Process each light source that affects this tile
    for (var i = 0u; i < params.light_count; i = i + 1u) {
        let light = light_sources[i];
        let light_dx = world_x - light.x;
        let light_dy = world_y - light.y;
        let light_dist = sqrt(light_dx * light_dx + light_dy * light_dy);
        
        // Only apply light if within radius
        if light_dist <= light.radius {
            // Use exact same logic as player's view distance
            let inner_radius = light.radius * 0.6; // 60% of radius is full strength
            let dither_radius = light.radius * 0.4; // 40% of radius for dithering
            
            // Calculate blend based on neutral percentage
            let neutral_percentage = light.neutral_percentage;
            let light_color = hex_to_rgb(light.color);
            
            // Blend between natural tile color and light color
            let natural_blend = neutral_percentage;
            let light_blend = 1.0 - neutral_percentage;
            let bright_color = tile_close_color * natural_blend + light_color * light_blend;

            var final_light_color: vec3<f32>;
            if light_dist <= inner_radius {
                // Full bright color in inner radius (same as player's close range)
                final_light_color = bright_color;
            } else {
                // Apply dithering in outer radius (same as player's dither range)
                final_light_color = dither(
                    light_dist,
                    inner_radius,
                    dither_radius,
                    params.steps,
                    bright_color,   // Start with bright light color
                    base_color      // Dither to distance-based color
                );
            }
            
            // Use the strongest light influence
            let light_influence = select(
                max(0.0, 1.0 - ((light_dist - inner_radius) / dither_radius)),
                1.0,
                light_dist <= inner_radius
            );

            if light_influence > max_light_influence {
                max_light_influence = light_influence;
                result_color = final_light_color;
            }
        }
    }

    return result_color;
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
    if color_kind >= 10u {
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
    fg_rgb = calculate_light_contribution(wx, wy, fg_rgb, tile.kind, tile.has_mask, tile.mask_kind);

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
