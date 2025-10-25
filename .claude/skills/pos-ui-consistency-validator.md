# pos-ui-consistency-validator

## Purpose
Validates UI components against design standards (CLAUDE.md requirements).

## Validation Checks
1. **Button Styles**
   - Primary actions: Green background, white text
   - Secondary: Gray outline
   - Destructive: Red background
   - NOT label-like (must have clear borders/background)

2. **Toggle States**
   - ON: Green with checkmark icon
   - OFF: Gray
   - State must be immediately obvious

3. **Form Consistency**
   - All forms use same component library (DevExtreme/Telerik)
   - Consistent spacing (4px grid)
   - Validation message placement

4. **Dark Mode Support**
   - No dark-on-dark combinations
   - No light-on-light combinations
   - Proper contrast ratios (WCAG AA)

5. **Responsive Design**
   - Mobile breakpoints: 640px, 768px, 1024px
   - Stack vertically on mobile
   - Touch-friendly targets (44px minimum)
