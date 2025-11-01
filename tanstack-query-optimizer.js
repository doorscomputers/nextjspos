#!/usr/bin/env node

/**
 * TanStack Query Optimizer
 * 
 * This script analyzes data fetching patterns and generates optimized
 * TanStack Query configurations with appropriate staleTime/gcTime based on update frequency.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SRC_DIR = './src';
const OUTPUT_DIR = './optimization-results/tanstack-query';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Query frequency patterns based on business logic
const QUERY_PATTERNS = {
    // High frequency - updates every few minutes
    'dashboard-stats': {
        staleTime: 2 * 60 * 1000, // 2 minutes
        gcTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        placeholderData: 'keepPreviousData'
    },
    'sales-data': {
        staleTime: 1 * 60 * 1000, // 1 minute
        gcTime: 3 * 60 * 1000, // 3 minutes
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        placeholderData: 'keepPreviousData'
    },
    'inventory-stock': {
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 2 * 60 * 1000, // 2 minutes
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        placeholderData: 'keepPreviousData'
    },

    // Medium frequency - updates every 15-30 minutes
    'products-list': {
        staleTime: 15 * 60 * 1000, // 15 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'customers-list': {
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'suppliers-list': {
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'locations-list': {
        staleTime: 60 * 60 * 1000, // 1 hour
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },

    // Low frequency - updates rarely
    'categories-list': {
        staleTime: 2 * 60 * 60 * 1000, // 2 hours
        gcTime: 4 * 60 * 60 * 1000, // 4 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'brands-list': {
        staleTime: 2 * 60 * 60 * 1000, // 2 hours
        gcTime: 4 * 60 * 60 * 1000, // 4 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'units-list': {
        staleTime: 4 * 60 * 60 * 1000, // 4 hours
        gcTime: 8 * 60 * 60 * 1000, // 8 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'taxes-list': {
        staleTime: 4 * 60 * 60 * 1000, // 4 hours
        gcTime: 8 * 60 * 60 * 1000, // 8 hours
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },

    // Reports - very low frequency
    'reports-data': {
        staleTime: 5 * 60 * 1000, // 5 minutes (reports are generated on demand)
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    },
    'analytics-data': {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: 'keepPreviousData'
    }
};

/**
 * Find all files with data fetching patterns
 */
function findDataFetchingFiles(dir) {
    const files = [];

    function traverse(currentDir) {
        const items = fs.readdirSync(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                traverse(fullPath);
            } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes('fetch(') || content.includes('useEffect') || content.includes('useState')) {
                    files.push(fullPath);
                }
            }
        }
    }

    traverse(dir);
    return files;
}

/**
 * Analyze data fetching patterns in a file
 */
function analyzeDataFetchingPatterns(content, filePath) {
    const patterns = [];

    // Pattern 1: useEffect with fetch
    const useEffectFetchRegex = /useEffect\(\(\)\s*=>\s*\{[\s\S]*?fetch\(['"`]([^'"`]+)['"`][\s\S]*?\}, \[\]\)/g;
    let match;

    while ((match = useEffectFetchRegex.exec(content)) !== null) {
        const apiEndpoint = match[1];
        const queryType = determineQueryType(apiEndpoint, filePath);

        patterns.push({
            type: 'useEffect-fetch',
            apiEndpoint,
            queryType,
            line: content.substring(0, match.index).split('\n').length,
            before: match[0],
            after: generateTanStackQuery(queryType, apiEndpoint)
        });
    }

    // Pattern 2: Direct fetch calls
    const directFetchRegex = /fetch\(['"`]([^'"`]+)['"`]\)/g;
    while ((match = directFetchRegex.exec(content)) !== null) {
        const apiEndpoint = match[1];
        const queryType = determineQueryType(apiEndpoint, filePath);

        patterns.push({
            type: 'direct-fetch',
            apiEndpoint,
            queryType,
            line: content.substring(0, match.index).split('\n').length,
            before: match[0],
            after: generateTanStackQuery(queryType, apiEndpoint)
        });
    }

    return patterns;
}

/**
 * Determine query type based on API endpoint and file path
 */
function determineQueryType(apiEndpoint, filePath) {
    const endpoint = apiEndpoint.toLowerCase();
    const path = filePath.toLowerCase();

    // High frequency patterns
    if (endpoint.includes('dashboard/stats') || endpoint.includes('dashboard/analytics')) {
        return 'dashboard-stats';
    }
    if (endpoint.includes('sales') && !endpoint.includes('reports')) {
        return 'sales-data';
    }
    if (endpoint.includes('inventory') || endpoint.includes('stock')) {
        return 'inventory-stock';
    }

    // Medium frequency patterns
    if (endpoint.includes('products') && !endpoint.includes('reports')) {
        return 'products-list';
    }
    if (endpoint.includes('customers')) {
        return 'customers-list';
    }
    if (endpoint.includes('suppliers')) {
        return 'suppliers-list';
    }
    if (endpoint.includes('locations')) {
        return 'locations-list';
    }

    // Low frequency patterns
    if (endpoint.includes('categories')) {
        return 'categories-list';
    }
    if (endpoint.includes('brands')) {
        return 'brands-list';
    }
    if (endpoint.includes('units')) {
        return 'units-list';
    }
    if (endpoint.includes('taxes')) {
        return 'taxes-list';
    }

    // Reports
    if (endpoint.includes('reports') || path.includes('reports')) {
        return 'reports-data';
    }
    if (endpoint.includes('analytics') || path.includes('analytics')) {
        return 'analytics-data';
    }

    // Default to medium frequency
    return 'products-list';
}

/**
 * Generate TanStack Query configuration
 */
function generateTanStackQuery(queryType, apiEndpoint) {
    const config = QUERY_PATTERNS[queryType] || QUERY_PATTERNS['products-list'];

    return `useQuery({
  queryKey: ['${queryType}', '${apiEndpoint}'],
  queryFn: async () => {
    const response = await fetch('${apiEndpoint}');
    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }
    return response.json();
  },
  staleTime: ${config.staleTime},
  gcTime: ${config.gcTime},
  refetchOnWindowFocus: ${config.refetchOnWindowFocus},
  refetchOnMount: ${config.refetchOnMount},
  placeholderData: ${config.placeholderData}
})`;
}

/**
 * Generate custom hooks for common queries
 */
function generateCustomHooks() {
    const hooks = [];

    Object.entries(QUERY_PATTERNS).forEach(([queryType, config]) => {
        const hookName = `use${queryType.charAt(0).toUpperCase() + queryType.slice(1).replace('-', '')}`;
        const apiEndpoint = getApiEndpoint(queryType);

        hooks.push(`import { useQuery } from '@tanstack/react-query'

export function ${hookName}(params = {}) {
  return useQuery({
    queryKey: ['${queryType}', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams(params)
      const response = await fetch(\`${apiEndpoint}?\${searchParams.toString()}\`)
      if (!response.ok) {
        throw new Error('Failed to fetch ${queryType}')
      }
      return response.json()
    },
    staleTime: ${config.staleTime},
    gcTime: ${config.gcTime},
    refetchOnWindowFocus: ${config.refetchOnWindowFocus},
    refetchOnMount: ${config.refetchOnMount},
    placeholderData: ${config.placeholderData}
  })
}`);
    });

    return hooks;
}

/**
 * Get API endpoint for query type
 */
function getApiEndpoint(queryType) {
    const endpointMap = {
        'dashboard-stats': '/api/dashboard/stats',
        'sales-data': '/api/sales',
        'inventory-stock': '/api/products/stock',
        'products-list': '/api/products',
        'customers-list': '/api/customers',
        'suppliers-list': '/api/suppliers',
        'locations-list': '/api/locations',
        'categories-list': '/api/categories',
        'brands-list': '/api/brands',
        'units-list': '/api/units',
        'taxes-list': '/api/taxes',
        'reports-data': '/api/reports',
        'analytics-data': '/api/dashboard/analytics'
    };

    return endpointMap[queryType] || '/api/products';
}

/**
 * Generate QueryClient configuration
 */
function generateQueryClientConfig() {
    return `import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global defaults
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error.status >= 400 && error.status < 500) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error)
        // You can add global error handling here
      }
    }
  }
})`;
}

/**
 * Generate React Query DevTools configuration
 */
function generateDevToolsConfig() {
    return `import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function QueryDevtools() {
  return (
    <ReactQueryDevtools
      initialIsOpen={false}
      position="bottom-right"
      buttonPosition="bottom-right"
    />
  )
}`;
}

/**
 * Generate mutation hooks for common operations
 */
function generateMutationHooks() {
    return `import { useMutation, useQueryClient } from '@tanstack/react-query'

// Generic mutation hook
export function useGenericMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn,
    onSuccess: (data, variables, context) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries()
      options.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      console.error('Mutation error:', error)
      options.onError?.(error, variables, context)
    },
    ...options
  })
}

// Product mutations
export function useCreateProduct() {
  return useGenericMutation(async (productData) => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    })
    if (!response.ok) throw new Error('Failed to create product')
    return response.json()
  }, {
    onSuccess: () => {
      // Invalidate products list
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
    }
  })
}

export function useUpdateProduct() {
  return useGenericMutation(async ({ id, ...productData }) => {
    const response = await fetch(\`/api/products/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    })
    if (!response.ok) throw new Error('Failed to update product')
    return response.json()
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
    }
  })
}

export function useDeleteProduct() {
  return useGenericMutation(async (id) => {
    const response = await fetch(\`/api/products/\${id}\`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete product')
    return response.json()
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
    }
  })
}`;
}

/**
 * Main optimization process
 */
function main() {
    console.log('🔍 Finding data fetching patterns...');
    const files = findDataFetchingFiles(SRC_DIR);
    console.log(`Found ${files.length} files with data fetching`);

    console.log('📊 Analyzing patterns...');
    const allPatterns = [];

    files.forEach(filePath => {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const patterns = analyzeDataFetchingPatterns(content, filePath);
            allPatterns.push({ file: filePath, patterns });
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error.message);
        }
    });

    // Generate custom hooks
    console.log('🎣 Generating custom hooks...');
    const customHooks = generateCustomHooks();
    customHooks.forEach((hook, index) => {
        const hookPath = path.join(OUTPUT_DIR, 'hooks', `use${Object.keys(QUERY_PATTERNS)[index].charAt(0).toUpperCase() + Object.keys(QUERY_PATTERNS)[index].slice(1).replace('-', '')}.ts`);
        const hookDir = path.dirname(hookPath);

        if (!fs.existsSync(hookDir)) {
            fs.mkdirSync(hookDir, { recursive: true });
        }

        fs.writeFileSync(hookPath, hook);
    });

    // Generate QueryClient configuration
    console.log('⚙️ Generating QueryClient configuration...');
    const queryClientConfig = generateQueryClientConfig();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'lib', 'queryClient.ts'), queryClientConfig);

    // Generate DevTools configuration
    const devToolsConfig = generateDevToolsConfig();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'components', 'QueryDevtools.tsx'), devToolsConfig);

    // Generate mutation hooks
    const mutationHooks = generateMutationHooks();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'hooks', 'mutations.ts'), mutationHooks);

    // Generate report
    const report = {
        summary: {
            filesAnalyzed: files.length,
            totalPatterns: allPatterns.reduce((sum, f) => sum + f.patterns.length, 0),
            queryTypes: Object.keys(QUERY_PATTERNS).length,
            customHooksGenerated: customHooks.length
        },
        patterns: allPatterns.filter(f => f.patterns.length > 0),
        queryConfigurations: QUERY_PATTERNS,
        recommendations: [
            'Replace useEffect + fetch with useQuery hooks',
            'Use custom hooks for common queries',
            'Implement proper error handling',
            'Add loading states and placeholder data',
            'Use mutations for data modifications',
            'Implement optimistic updates where appropriate'
        ]
    };

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'tanstack-query-report.json'),
        JSON.stringify(report, null, 2)
    );

    console.log('✅ TanStack Query optimization complete!');
    console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
    console.log(`📊 Analyzed ${files.length} files`);
    console.log(`🔄 Found ${report.summary.totalPatterns} data fetching patterns`);
    console.log(`🎣 Generated ${customHooks.length} custom hooks`);
    console.log(`⚙️ Generated QueryClient configuration`);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    findDataFetchingFiles,
    analyzeDataFetchingPatterns,
    determineQueryType,
    generateTanStackQuery,
    generateCustomHooks,
    generateQueryClientConfig,
    generateMutationHooks
};
