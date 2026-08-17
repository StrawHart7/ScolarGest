---
name: Luminous Institutional
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#FBFBFC'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#434654'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#737685'
  outline-variant: '#c3c6d6'
  surface-tint: '#0c56d0'
  primary: '#003d9b'
  on-primary: '#ffffff'
  primary-container: '#0052cc'
  on-primary-container: '#c4d2ff'
  inverse-primary: '#b2c5ff'
  secondary: '#4f5f7b'
  on-secondary: '#ffffff'
  secondary-container: '#cdddff'
  on-secondary-container: '#51617e'
  tertiary: '#004e33'
  on-tertiary: '#ffffff'
  tertiary-container: '#056846'
  on-tertiary-container: '#91e4b9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b2c5ff'
  on-primary-fixed: '#001848'
  on-primary-fixed-variant: '#0040a2'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#b7c7e8'
  on-secondary-fixed: '#091c35'
  on-secondary-fixed-variant: '#374763'
  tertiary-fixed: '#a0f4c8'
  tertiary-fixed-dim: '#85d7ad'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
  surface-border: '#DFE1E6'
  text-primary: '#172B4D'
  text-secondary: '#44546F'
typography:
  display-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  data-mono:
    fontFamily: jetbrainsMono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  sidebar-width: 260px
  header-height: 56px
  container-padding: 24px
  gutter: 16px
  row-dense: 32px
  row-standard: 44px
---

## Brand & Style
The design system evolves the "Institutional Rigor" aesthetic into a lighter, more breathable framework. It is designed for high-density professional environments—such as fintech, healthcare administration, and enterprise resource planning—where clarity and focus are the highest priorities. The brand personality is clinical, precise, and transparent.

The visual direction utilizes **Systematic Minimalism** with a focus on **High-Contrast / Bold** legibility. By removing heavy dark blocks, the UI feels more modern and less "closed-in," while maintaining the serious, banking-grade reliability required for complex workflows. The emotional response is one of organized efficiency and modern professionalism.

## Colors
The palette shifts from heavy navy to an airy, light-gray foundation. The primary accent is a crisp, professional blue, used strategically for interactivity and focus.

- **Primary**: A vibrant yet professional Blue (#0052CC) for active states, primary actions, and key indicators.
- **Surface & Backgrounds**: The main workspace uses a clean white, while the sidebar and header now use `surface-container-low` (#FBFBFC) to provide subtle structural separation without visual weight.
- **Neutrals**: A range of cool grays (Slate/Zinc) provides boundaries. Text contrast is strictly maintained at high ratios against the light backgrounds to ensure maximum readability.
- **Semantic Colors**: Retain professional saturation—Deep Green for success, Ruby Red for errors, and Amber for warnings—ensuring they remain authoritative markers within the light interface.

## Typography
The system relies on **Inter** for all UI elements due to its neutrality and excellent performance at small sizes. **JetBrains Mono** is reserved strictly for tabular data, IDs, and financial figures where character-width consistency is vital for scanning.

Hierarchy is achieved through weight and color (using `text-primary` for headlines and `text-secondary` for supporting copy) rather than size. In this high-density environment, typography rarely exceeds 24px, ensuring that complex data remains the focal point. Use `label-md` in uppercase for table headers to provide a distinct structural rhythm.

## Layout & Spacing
The layout follows a **Fixed Sidebar / Fluid Content** model. It is built on a 4px baseline grid to ensure mathematical precision in component alignment.

- **Grid Model**: A 12-column fluid grid is used for the main workspace. Elements should snap to column counts (e.g., side-by-side forms each taking 6 columns).
- **Density**: The system prioritizes vertical efficiency. `row-dense` is used for large-scale data grids, while `row-standard` is used for standard form entry.
- **Breakpoints**: 
  - **Mobile (<768px)**: Sidebar collapses to a drawer; margins reduce to 16px.
  - **Tablet (768px - 1024px)**: 12-column grid remains, sidebar may collapse to icon-only.
  - **Desktop (>1024px)**: Fixed 260px sidebar and full fluid workspace.

## Elevation & Depth
In this lighter system, depth is communicated through **Tonal Layers** and **Low-contrast outlines** rather than shadows. This maintains a flat, "scientific" feel.

- **Stacking**: The base background is `neutral`. The "Workspace" sits on white sheets. Structural containers (Sidebar, Header) use `surface-container-low`.
- **Borders**: 1px solid borders in `surface-border` define almost all UI boundaries. This replaces the need for elevation shadows.
- **Floating Elements**: Only high-priority temporary elements (Modals, Popovers) use a shadow. Use a very soft, diffused shadow: `0px 4px 12px rgba(9, 30, 66, 0.08)`.

## Shapes
The shape language is **Soft** (4px radius). This provides a subtle modern touch without sacrificing the professional "grid" feel required for banking and medical software.

- **Buttons & Inputs**: 4px (0.25rem) radius.
- **Containers**: Large cards and workspace sheets use 4px or 8px (0.5rem) for a slightly more defined container edge.
- **Elements**: Selection indicators (like sidebar active states) should be 4px or use a vertical 3px "pill" on the leading edge.

## Components
- **Buttons**: 
  - **Primary**: Solid Primary Blue (#0052CC) with white text.
  - **Secondary**: Clear background, 1px border (#DFE1E6), Primary Blue text.
  - **Ghost**: No border or background until hover.
- **Inputs**: Use a 1px border (#DFE1E6). On focus, the border changes to Primary Blue with a 2px soft blue halo (0.2 opacity). Labels are always `label-md` and positioned above the field.
- **Data Tables**: Use 1px horizontal dividers. No vertical lines. Header cells use `label-md` with `text-secondary` color. Use alternating row backgrounds (zebra striping) only on hover.
- **Sidebar**: Now uses a very light gray background (`surface-container-low`) with Primary Blue used exclusively for the active menu item text and a leading-edge indicator.
- **Cards**: White background with a 1px `surface-border`. No shadow.
- **Chips/Badges**: Use "Soft" fills (e.g., a 10% opacity version of the semantic color) with high-contrast bold text for status indicators.