"use client";

export default function TestHistoricalInventoryPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Historical Inventory Report - Test</h1>
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Test Components</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Target Date</label>
            <input
              type="date"
              className="border rounded px-3 py-2 w-full max-w-xs"
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <select className="border rounded px-3 py-2 w-full max-w-xs">
              <option>All Locations</option>
              <option>Warehouse</option>
              <option>Main Store</option>
            </select>
          </div>

          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Generate Report
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">Status: ✅ Page Loading Successfully</h3>
          <p className="text-sm text-gray-600">
            If you can see this test page, the routing is working correctly.
            The issue might be with the UI component imports or API calls.
          </p>
        </div>
      </div>
    </div>
  );
}