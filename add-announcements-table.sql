-- Add Announcements table for scrolling ticker feature
-- Run this manually: psql -U your_user -d ultimatepos_modern -f add-announcements-table.sql

CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES business(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    priority VARCHAR(20) NOT NULL DEFAULT 'info',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    target_roles TEXT,
    target_locations TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_announcements_business_id ON announcements(business_id);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_start_date ON announcements(start_date);
CREATE INDEX IF NOT EXISTS idx_announcements_end_date ON announcements(end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_display_order ON announcements(display_order);

-- Add sample announcement
INSERT INTO announcements (business_id, title, message, type, priority, icon, created_by_id, is_active)
VALUES (
    1,
    'Welcome to the Announcement System!',
    '📢 You can now display important messages, reminders, and announcements here. Manage them from Settings > Announcements',
    'system',
    'info',
    '📢',
    1,
    true
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE announcements IS 'Stores business announcements and reminders displayed in the header ticker';
