# Installing Skills from Anthropic Repository

This guide explains how to install skills from the official [anthropics/skills](https://github.com/anthropics/skills) repository.

## Method 1: Manual Installation (Recommended)

### Step 1: Clone the Skills Repository

```bash
# Clone the entire repository
git clone https://github.com/anthropics/skills.git temp-skills

# Or clone with sparse checkout for specific skills
git clone --depth 1 --filter=blob:none --sparse https://github.com/anthropics/skills.git temp-skills
cd temp-skills
git sparse-checkout init --cone
```

### Step 2: Copy Specific Skills

```bash
# Copy individual skill to project
cp -r temp-skills/skill-creator .claude/skills/

# Copy multiple skills
cp -r temp-skills/skill-creator .claude/skills/
cp -r temp-skills/theme-factory .claude/skills/
cp -r temp-skills/document-skills/xlsx .claude/skills/
cp -r temp-skills/document-skills/pdf .claude/skills/

# Clean up
cd ..
rm -rf temp-skills
```

### Step 3: Verify Installation

```bash
# List installed skills
ls -la .claude/skills/

# Each skill should have a SKILL.md file
find .claude/skills/ -name "SKILL.md"
```

## Method 2: Using Git Subtree (For Version Control)

If you want to keep skills updated from the source:

```bash
# Add the skills repo as a remote
git remote add skills-upstream https://github.com/anthropics/skills.git

# Pull specific skill as subtree
git subtree add --prefix .claude/skills/skill-creator skills-upstream main --squash

# Update later
git subtree pull --prefix .claude/skills/skill-creator skills-upstream main --squash
```

## Method 3: Install to Personal Skills Directory

For skills you want available across all projects:

### Windows
```bash
# Create personal skills directory
mkdir -p %USERPROFILE%\.claude\skills

# Copy skills
xcopy /E /I temp-skills\skill-creator %USERPROFILE%\.claude\skills\skill-creator
```

### macOS/Linux
```bash
# Create personal skills directory
mkdir -p ~/.claude/skills

# Copy skills
cp -r temp-skills/skill-creator ~/.claude/skills/
```

## Recommended Skills for UltimatePOS

### Essential Skills

1. **skill-creator** - For creating custom skills
   ```bash
   cp -r temp-skills/skill-creator .claude/skills/
   ```

2. **theme-factory** - For styling UI components and reports
   ```bash
   cp -r temp-skills/theme-factory .claude/skills/
   ```

3. **xlsx** - For Excel exports (inventory, reports)
   ```bash
   cp -r temp-skills/document-skills/xlsx .claude/skills/xlsx
   ```

4. **pdf** - For generating invoices, receipts, reports
   ```bash
   cp -r temp-skills/document-skills/pdf .claude/skills/pdf
   ```

### Optional Skills

5. **webapp-testing** - For automated testing
   ```bash
   cp -r temp-skills/webapp-testing .claude/skills/
   ```

6. **canvas-design** - For designing UI mockups
   ```bash
   cp -r temp-skills/canvas-design .claude/skills/
   ```

## Quick Install Script

Create a file `install-skills.sh`:

```bash
#!/bin/bash

# Clone skills repository
git clone --depth 1 https://github.com/anthropics/skills.git temp-skills

# Create skills directory
mkdir -p .claude/skills

# Install recommended skills
cp -r temp-skills/skill-creator .claude/skills/
cp -r temp-skills/theme-factory .claude/skills/
cp -r temp-skills/document-skills/xlsx .claude/skills/xlsx
cp -r temp-skills/document-skills/pdf .claude/skills/pdf

# Clean up
rm -rf temp-skills

echo "Skills installed successfully!"
echo "Installed skills:"
ls -la .claude/skills/
```

Run it:
```bash
chmod +x install-skills.sh
./install-skills.sh
```

## For Windows (PowerShell)

Create `install-skills.ps1`:

```powershell
# Clone skills repository
git clone --depth 1 https://github.com/anthropics/skills.git temp-skills

# Create skills directory
New-Item -ItemType Directory -Force -Path .\.claude\skills

# Install recommended skills
Copy-Item -Recurse temp-skills\skill-creator .\.claude\skills\
Copy-Item -Recurse temp-skills\theme-factory .\.claude\skills\
Copy-Item -Recurse temp-skills\document-skills\xlsx .\.claude\skills\xlsx
Copy-Item -Recurse temp-skills\document-skills\pdf .\.claude\skills\pdf

# Clean up
Remove-Item -Recurse -Force temp-skills

Write-Host "Skills installed successfully!"
Write-Host "Installed skills:"
Get-ChildItem .\.claude\skills\
```

Run it:
```powershell
.\install-skills.ps1
```

## Verifying Skills Work

After installation, restart Claude Code and test:

```
# In Claude Code, try invoking a skill
Can you help me create a new skill using the skill-creator?

# Or
Use theme-factory to style this component
```

## Updating Skills

To update installed skills:

```bash
# Re-clone and copy
git clone --depth 1 https://github.com/anthropics/skills.git temp-skills
cp -r temp-skills/skill-creator .claude/skills/
rm -rf temp-skills
```

## Troubleshooting

### Skills Not Loading

1. **Check file structure**: Each skill must have a `SKILL.md` file
   ```bash
   find .claude/skills/ -name "SKILL.md"
   ```

2. **Verify YAML frontmatter**: Each SKILL.md must start with:
   ```yaml
   ---
   name: skill-name
   description: Skill description
   ---
   ```

3. **Restart Claude Code**: Skills are loaded at startup

### Permission Issues

```bash
# Fix permissions (Linux/Mac)
chmod -R 755 .claude/skills/

# Fix ownership
chown -R $USER .claude/skills/
```

## Next Steps

After installing skills:

1. Review the custom UltimatePOS skills in `.claude/skills/`
2. Try invoking `skill-creator` to build new custom skills
3. Use `theme-factory` for consistent UI styling
4. Explore document skills for report generation

## Resources

- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Claude Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Creating Custom Skills](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
