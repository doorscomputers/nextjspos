# UltimatePOS Modern - Claude Code Skills

This directory contains custom skills for Claude Code to enhance development workflow for the UltimatePOS Modern project.

## What are Skills?

Skills are folders containing a `SKILL.md` file with instructions that Claude loads dynamically to improve performance on specialized tasks. Skills help Claude complete specific tasks in a repeatable, consistent way.

## Directory Structure

```
.claude/skills/
├── README.md                    # This file
├── pos-component-creator/       # Example: Create POS-specific components
│   └── SKILL.md
├── rbac-permission-helper/      # Example: Help with RBAC permissions
│   └── SKILL.md
└── database-migration-helper/   # Example: Assist with Prisma migrations
    └── SKILL.md
```

## How to Use Skills

Skills are automatically loaded when relevant to the conversation. You can also explicitly invoke them using:

```
/skill-name
```

## Available Skills in Anthropic Repository

From the official [anthropics/skills](https://github.com/anthropics/skills) repository:

### General Purpose
- **skill-creator** - Guide for creating effective skills
- **theme-factory** - Style artifacts with themes
- **algorithmic-art** - Generate creative algorithmic artwork
- **canvas-design** - Create canvas-based designs
- **mcp-server** - Work with MCP servers
- **webapp-testing** - Test web applications

### Document Skills
- **docx** - Create Word documents
- **pdf** - Generate PDFs
- **pptx** - Create PowerPoint presentations
- **xlsx** - Work with Excel spreadsheets

## Skills Useful for UltimatePOS

Based on our project needs, the following skills would be most beneficial:

1. **skill-creator** - To build custom skills for our workflow
2. **theme-factory** - For styling reports and UI components
3. **xlsx** - For handling CSV/Excel imports/exports (inventory, products)
4. **pdf** - For generating invoices, receipts, reports
5. **webapp-testing** - For testing POS features

## Installation Methods

### Option 1: Via Plugin (Recommended)
Register the anthropics/skills repository as a plugin marketplace in Claude Code.

### Option 2: Manual Installation
Clone skills from the repository into this directory:

```bash
# Clone specific skill
git clone --depth 1 --filter=blob:none --sparse https://github.com/anthropics/skills.git temp-skills
cd temp-skills
git sparse-checkout set skill-creator
mv skill-creator ../.claude/skills/
cd ..
rm -rf temp-skills
```

### Option 3: Personal Skills
Install to `~/.claude/skills/` for use across all projects.

## Creating Custom Skills

A skill requires a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my-custom-skill
description: Brief description of what this skill does
---

# Instructions for Claude

Your detailed instructions here...
```

## Project-Specific Skill Ideas

### 1. POS Transaction Helper
- Guide Claude on handling sales transactions
- Include multi-tenant data isolation patterns
- RBAC permission checks
- Inventory updates

### 2. Report Generator
- Standardized report formatting
- Date range handling
- Export formats (PDF, Excel, CSV)
- BIR compliance (Philippines)

### 3. Multi-Tenant Validator
- Ensure all queries include businessId filtering
- Validate location-based operations
- Check RBAC permissions

### 4. API Route Creator
- Template for creating new API routes
- Authentication checks
- Error handling patterns
- Response formatting

## Resources

- [Anthropic Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Official Skills Repository](https://github.com/anthropics/skills)
- [Create Custom Skills Guide](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
