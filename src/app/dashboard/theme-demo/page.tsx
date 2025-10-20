'use client'

import { ThemeFactorySwitcher } from '@/components/ThemeFactorySwitcher'

export default function ThemeDemoPage() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="tf-heading-1 mb-2">Theme Factory Demo</h1>
        <p className="tf-body text-gray-600 dark:text-gray-400">
          Choose from 10 professional themes and see the changes in real-time
        </p>
      </div>

      {/* Theme Switcher */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          Select a Theme
        </h2>
        <ThemeFactorySwitcher variant="grid" showDescription={true} />
      </section>

      {/* Demo Components */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Component Preview
        </h2>

        {/* Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Buttons</h3>
          <div className="flex flex-wrap gap-4">
            <button className="tf-btn tf-btn-primary">Primary Button</button>
            <button className="tf-btn tf-btn-secondary">Secondary Button</button>
            <button className="tf-btn tf-btn-outline">Outline Button</button>
            <button className="tf-btn tf-btn-ghost">Ghost Button</button>
            <button className="tf-btn tf-btn-primary tf-btn-sm">Small</button>
            <button className="tf-btn tf-btn-primary tf-btn-lg">Large</button>
          </div>
        </div>

        {/* Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Cards</h3>
          <div className="tf-grid-3">
            <div className="tf-card">
              <h4 className="tf-heading-3 mb-2">Hover Card</h4>
              <p className="tf-body">This card has hover effects</p>
              <span className="tf-badge tf-badge-primary mt-3">Featured</span>
            </div>

            <div className="tf-card-flat">
              <h4 className="tf-heading-3 mb-2">Flat Card</h4>
              <p className="tf-body">This card has a flat design</p>
              <span className="tf-badge tf-badge-secondary mt-3">New</span>
            </div>

            <div className="tf-card-elevated tf-hover-lift">
              <h4 className="tf-heading-3 mb-2">Elevated Card</h4>
              <p className="tf-body">This card lifts on hover</p>
              <span className="tf-badge tf-badge-accent mt-3">Premium</span>
            </div>
          </div>
        </div>

        {/* Form Elements */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Form Elements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="tf-font-heading tf-text-primary block mb-2 font-semibold">
                Input Field
              </label>
              <input
                type="text"
                className="tf-input"
                placeholder="Enter your text here"
              />
            </div>

            <div>
              <label className="tf-font-heading tf-text-primary block mb-2 font-semibold">
                Select Dropdown
              </label>
              <select className="tf-select">
                <option>Option 1</option>
                <option>Option 2</option>
                <option>Option 3</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="tf-font-heading tf-text-primary block mb-2 font-semibold">
                Textarea
              </label>
              <textarea
                className="tf-textarea"
                placeholder="Enter your message here"
              />
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Typography</h3>
          <div className="space-y-4">
            <div>
              <h1 className="tf-heading-1">Heading 1</h1>
              <h2 className="tf-heading-2">Heading 2</h2>
              <h3 className="tf-heading-3">Heading 3</h3>
            </div>
            <div>
              <p className="tf-body-lg">Large body text for emphasis and important content.</p>
              <p className="tf-body">Normal body text for general content and paragraphs.</p>
              <p className="tf-body-sm">Small text for captions, notes, and metadata.</p>
            </div>
            <div>
              <a href="#" className="tf-link">This is a link with hover effects</a>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Badges</h3>
          <div className="flex flex-wrap gap-3">
            <span className="tf-badge tf-badge-primary">Primary</span>
            <span className="tf-badge tf-badge-secondary">Secondary</span>
            <span className="tf-badge tf-badge-accent">Accent</span>
            <span className="tf-badge tf-badge-outline">Outline</span>
          </div>
        </div>

        {/* Dashboard Example */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Dashboard Cards Example</h3>
          <div className="tf-grid-3">
            <div className="tf-card-elevated">
              <div className="tf-flex tf-flex-between mb-4">
                <h4 className="tf-heading-3">Total Sales</h4>
                <span className="tf-badge tf-badge-primary">+12%</span>
              </div>
              <p className="tf-heading-1">₱125,430</p>
              <p className="tf-body-sm tf-text-muted">vs last month</p>
            </div>

            <div className="tf-card-elevated">
              <div className="tf-flex tf-flex-between mb-4">
                <h4 className="tf-heading-3">New Customers</h4>
                <span className="tf-badge tf-badge-secondary">+8%</span>
              </div>
              <p className="tf-heading-1">342</p>
              <p className="tf-body-sm tf-text-muted">vs last month</p>
            </div>

            <div className="tf-card-elevated">
              <div className="tf-flex tf-flex-between mb-4">
                <h4 className="tf-heading-3">Products</h4>
                <span className="tf-badge tf-badge-accent">1,240</span>
              </div>
              <p className="tf-heading-1">Active</p>
              <p className="tf-body-sm tf-text-muted">in inventory</p>
            </div>
          </div>
        </div>

        {/* Hover Effects */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="tf-heading-3 mb-4">Hover Effects</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="tf-card tf-hover-lift p-6 text-center">
              <p className="font-semibold">Lift Effect</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hover to see</p>
            </div>
            <div className="tf-card tf-hover-scale p-6 text-center">
              <p className="font-semibold">Scale Effect</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hover to see</p>
            </div>
            <div className="tf-card tf-hover-glow p-6 text-center">
              <p className="font-semibold">Glow Effect</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hover to see</p>
            </div>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800">
        <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-3">
          🎨 How to Use Theme Factory
        </h3>
        <div className="space-y-2 text-blue-800 dark:text-blue-200">
          <p>1. <strong>Select a theme</strong> from the grid above</p>
          <p>2. <strong>Watch components update</strong> with the new color palette</p>
          <p>3. <strong>Your choice is saved</strong> automatically in localStorage</p>
          <p>4. <strong>Use tf-* classes</strong> in your components to apply the theme</p>
          <p className="mt-4 text-sm">
            📖 Check <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">THEME_FACTORY_INTEGRATION.md</code> for complete documentation
          </p>
        </div>
      </section>
    </div>
  )
}
