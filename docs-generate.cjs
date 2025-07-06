#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Generating comprehensive documentation...\n');

// Create docs directory
if (!fs.existsSync('docs-auto')) {
  fs.mkdirSync('docs-auto', { recursive: true });
}

// 1. Generate API documentation using tsdoc-markdown
console.log('📚 Generating API documentation...');
try {
  execSync('npx tsdoc-markdown --src=src/lib/index.ts,src/lib/entity.ts,src/lib/map.ts,src/lib/gpu.ts,src/lib/inventory.ts --dest=docs-auto/API.md --types --repo=https://github.com/yourusername/game-engine', { stdio: 'inherit' });
  console.log('✅ API documentation generated!\n');
} catch (error) {
  console.log('⚠️  API documentation failed, trying individual files...\n');
  
  // Generate docs for individual files
  const files = [
    'src/lib/index.ts',
    'src/lib/entity.ts', 
    'src/lib/map.ts',
    'src/lib/gpu.ts',
    'src/lib/inventory.ts'
  ];
  
  let allDocs = '# Game Engine API Documentation\n\n';
  
  files.forEach(file => {
    try {
      console.log(`  Generating docs for ${file}...`);
      execSync(`npx tsdoc-markdown --src=${file} --dest=temp-${path.basename(file, '.ts')}.md --noemoji`, { stdio: 'pipe' });
      
      if (fs.existsSync(`temp-${path.basename(file, '.ts')}.md`)) {
        const content = fs.readFileSync(`temp-${path.basename(file, '.ts')}.md`, 'utf8');
        allDocs += `\n## ${path.basename(file, '.ts').toUpperCase()}\n\n${content}\n\n`;
        fs.unlinkSync(`temp-${path.basename(file, '.ts')}.md`);
      }
    } catch (err) {
      console.log(`  ⚠️  Failed to generate docs for ${file}`);
    }
  });
  
  fs.writeFileSync('docs-auto/API.md', allDocs);
  console.log('✅ Individual API documentation generated!\n');
}

// 2. Generate Convex API documentation
console.log('🔌 Generating Convex API documentation...');
try {
  const convexFiles = [
    'convex/users.ts',
    'convex/functions/getTileSet.ts',
    'convex/functions/saveTileSet.ts',
    'convex/functions/entityStates.ts',
    'convex/functions/clusters.ts'
  ];
  
  let convexDocs = '# Convex Backend API\n\n';
  convexDocs += 'This documentation covers all the Convex backend functions and mutations.\n\n';
  
  convexFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  Processing ${file}...`);
      const content = fs.readFileSync(file, 'utf8');
      
      // Extract function signatures and comments
      const functions = content.match(/export\s+const\s+\w+\s*=\s*(query|mutation|internalMutation)/g) || [];
      const comments = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
      
      convexDocs += `\n## ${path.basename(file, '.ts')}\n\n`;
      convexDocs += `**File**: \`${file}\`\n\n`;
      
      functions.forEach(func => {
        const funcName = func.match(/export\s+const\s+(\w+)/)?.[1];
        const funcType = func.match(/(query|mutation|internalMutation)/)?.[1];
        if (funcName && funcType) {
          convexDocs += `### ${funcName}\n`;
          convexDocs += `**Type**: ${funcType}\n\n`;
          
          // Find related comments
          const funcIndex = content.indexOf(func);
          const beforeContent = content.substring(0, funcIndex);
          const lastComment = beforeContent.match(/\/\*\*[\s\S]*?\*\/(?=\s*export)/);
          if (lastComment) {
            const cleanComment = lastComment[0]
              .replace(/\/\*\*|\*\//g, '')
              .replace(/^\s*\*\s?/gm, '')
              .trim();
            if (cleanComment) {
              convexDocs += `${cleanComment}\n\n`;
            }
          }
          
          convexDocs += '```typescript\n';
          convexDocs += func + '\n';
          convexDocs += '```\n\n';
        }
      });
    }
  });
  
  fs.writeFileSync('docs-auto/CONVEX_API.md', convexDocs);
  console.log('✅ Convex API documentation generated!\n');
} catch (error) {
  console.log('⚠️  Convex documentation failed\n');
}

// 3. Generate component documentation
console.log('🎨 Generating component documentation...');
try {
  const componentFiles = [
    'src/components/game.tsx',
    'src/components/inventoryView.tsx',
    'src/components/menu.tsx',
    'src/components/main-menu.tsx'
  ];
  
  let componentDocs = '# React/SolidJS Components\n\n';
  componentDocs += 'This documentation covers all the UI components in the game.\n\n';
  
  componentFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`  Processing ${file}...`);
      const content = fs.readFileSync(file, 'utf8');
      
      // Extract component exports and props
      const exports = content.match(/export\s+(?:default\s+)?function\s+(\w+)|export\s+(?:default\s+)?(?:const|let)\s+(\w+)/g) || [];
      const interfaces = content.match(/interface\s+(\w+Props?)\s*{[\s\S]*?}/g) || [];
      
      componentDocs += `\n## ${path.basename(file, '.tsx')}\n\n`;
      componentDocs += `**File**: \`${file}\`\n\n`;
      
      // Document interfaces (props)
      interfaces.forEach(iface => {
        componentDocs += '### Props\n\n';
        componentDocs += '```typescript\n';
        componentDocs += iface + '\n';
        componentDocs += '```\n\n';
      });
      
      // Document exports
      exports.forEach(exp => {
        const componentName = exp.match(/(\w+)$/)?.[1];
        if (componentName) {
          componentDocs += `### ${componentName}\n\n`;
          
          // Look for JSDoc comments
          const expIndex = content.indexOf(exp);
          const beforeContent = content.substring(0, expIndex);
          const lastComment = beforeContent.match(/\/\*\*[\s\S]*?\*\/(?=\s*export)/);
          if (lastComment) {
            const cleanComment = lastComment[0]
              .replace(/\/\*\*|\*\//g, '')
              .replace(/^\s*\*\s?/gm, '')
              .trim();
            if (cleanComment) {
              componentDocs += `${cleanComment}\n\n`;
            }
          }
        }
      });
    }
  });
  
  fs.writeFileSync('docs-auto/COMPONENTS.md', componentDocs);
  console.log('✅ Component documentation generated!\n');
} catch (error) {
  console.log('⚠️  Component documentation failed\n');
}

// 4. Generate README with all documentation links
console.log('📝 Generating master documentation index...');
const masterReadme = `# 🎮 Game Engine Documentation

> Auto-generated documentation for the tile-based game engine

## 📚 Documentation Sections

### 🔧 [API Documentation](./API.md)
Complete TypeScript API documentation for all core classes and functions:
- Engine class and methods
- Entity system components  
- Map and tile management
- GPU rendering system
- Inventory and item management

### 🔌 [Backend API](./CONVEX_API.md) 
Convex backend functions and database operations:
- User management
- TileSet CRUD operations
- Entity state persistence
- Cluster management
- Real-time data sync

### 🎨 [UI Components](./COMPONENTS.md)
React/SolidJS component documentation:
- Game component
- Inventory viewer
- Menu systems
- User interface elements

## 🚀 Quick Start

\`\`\`typescript
import { Engine } from "~/lib";
import { ConvexClient } from "convex/browser";

// Initialize the game engine
const convex = new ConvexClient(process.env.CONVEX_URL);
const engine = new Engine(1000, 1000, convex);

// Start the game
await engine.start();
await engine.renderDOM();
\`\`\`

## 🔄 Regenerating Documentation

To regenerate this documentation:

\`\`\`bash
npm run docs:generate
\`\`\`

---

*Last generated: ${new Date().toISOString()}*
`;

fs.writeFileSync('docs-auto/README.md', masterReadme);
console.log('✅ Master documentation index generated!\n');

console.log('🎉 Documentation generation complete!');
console.log('📁 Check the docs-auto/ directory for all generated documentation');