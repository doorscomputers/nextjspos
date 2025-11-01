#!/usr/bin/env node

/**
 * DevExtreme Remote Operations Optimizer
 * 
 * This script converts DevExtreme DataGrid components to use remote operations
 * with server-side pagination, sorting, and filtering for better performance.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DASHBOARD_DIR = './src/app/dashboard';
const API_DIR = './src/app/api';
const OUTPUT_DIR = './optimization-results/devextreme-remote';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Find all DevExtreme DataGrid components
 */
function findDataGridFiles(dir) {
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
        if (content.includes('DataGrid') && content.includes('devextreme-react')) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Extract DataGrid configuration from file
 */
function extractDataGridConfig(content) {
  const configs = [];

  // Find DataGrid components
  const dataGridRegex = /<DataGrid[^>]*>([\s\S]*?)<\/DataGrid>/g;
  let match;

  while ((match = dataGridRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const innerContent = match[1];

    // Extract props
    const props = {};
    const propRegex = /(\w+)=["']([^"']*)["']/g;
    let propMatch;

    while ((propMatch = propRegex.exec(fullMatch)) !== null) {
      props[propMatch[1]] = propMatch[2];
    }

    // Extract columns
    const columns = [];
    const columnRegex = /<Column[^>]*dataField=["']([^"']*)["'][^>]*\/>/g;
    let columnMatch;

    while ((columnMatch = columnRegex.exec(innerContent)) !== null) {
      columns.push(columnMatch[1]);
    }

    configs.push({
      fullMatch,
      props,
      columns,
      innerContent
    });
  }

  return configs;
}

/**
 * Generate remote data source configuration
 */
function generateRemoteDataSource(tableName, columns) {
  return {
    store: {
      type: 'odata',
      url: `/api/${tableName}`,
      version: 4,
      key: 'id',
      keyType: 'Int32',
      beforeSend: (request) => {
        // Add authentication headers
        const token = localStorage.getItem('auth-token');
        if (token) {
          request.headers['Authorization'] = `Bearer ${token}`;
        }
      }
    },
    paginate: true,
    pageSize: 20,
    pageSizes: [10, 20, 50, 100],
    remoteOperations: {
      paging: true,
      sorting: true,
      filtering: true,
      grouping: false,
      summary: false
    }
  };
}

/**
 * Generate optimized DataGrid component
 */
function generateOptimizedDataGrid(config, tableName) {
  const { props, columns } = config;

  return `<DataGrid
  dataSource={dataSource}
  keyExpr="id"
  showBorders={true}
  columnAutoWidth={true}
  rowAlternationEnabled={true}
  height={600}
  remoteOperations={{
    paging: true,
    sorting: true,
    filtering: true,
    grouping: false,
    summary: false
  }}
  onExporting={handleExport}
  onRowClick={handleRowClick}
  onSelectionChanged={handleSelectionChanged}
>
  <LoadPanel enabled={true} />
  <Scrolling mode="virtual" />
  <Paging
    enabled={true}
    pageSize={20}
    pageSizes={[10, 20, 50, 100]}
  />
  <Pager
    visible={true}
    allowedPageSizes={[10, 20, 50, 100]}
    showPageSizeSelector={true}
    showNavigationButtons={true}
    showInfo={true}
  />
  <FilterRow visible={true} />
  <HeaderFilter visible={true} />
  <SearchPanel visible={true} width={300} placeholder="Search..." />
  <ColumnChooser enabled={true} mode="select" />
  <StateStoring
    enabled={true}
    type="localStorage"
    storageKey="${tableName}GridState"
  />
  <Export enabled={true} formats={['xlsx', 'pdf']} />
  
  ${columns.map(col => `<Column
    dataField="${col}"
    caption="${col.charAt(0).toUpperCase() + col.slice(1)}"
    minWidth={120}
    allowSorting={true}
    allowFiltering={true}
  />`).join('\n  ')}
</DataGrid>`;
}

/**
 * Generate server-side API handler
 */
function generateApiHandler(tableName, columns) {
  return `import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.${tableName.toUpperCase()}_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse DevExtreme DataSource parameters
    const { searchParams } = new URL(request.url)
    
    // Pagination
    const skip = parseInt(searchParams.get('$skip') || '0')
    const take = parseInt(searchParams.get('$top') || '20')
    
    // Sorting
    const orderBy = searchParams.get('$orderby')
    let sortConfig = {}
    if (orderBy) {
      const [field, direction] = orderBy.split(' ')
      sortConfig[field] = direction || 'asc'
    } else {
      sortConfig = { createdAt: 'desc' }
    }
    
    // Filtering
    const filter = searchParams.get('$filter')
    let whereClause = { businessId: parseInt(businessId) }
    
    if (filter) {
      // Parse OData filter to Prisma where clause
      whereClause = parseODataFilter(filter, businessId)
    }
    
    // Search
    const search = searchParams.get('$search')
    if (search) {
      whereClause.OR = [
        ${columns.map(col => `{ ${col}: { contains: search, mode: 'insensitive' } }`).join(',\n        ')}
      ]
    }

    // Execute query
    const [data, totalCount] = await Promise.all([
      prisma.${tableName}.findMany({
        where: whereClause,
        select: {
          id: true,
          ${columns.map(col => `${col}: true`).join(',\n          ')},
          createdAt: true,
          updatedAt: true
        },
        orderBy: sortConfig,
        skip,
        take
      }),
      prisma.${tableName}.count({ where: whereClause })
    ])

    // Return DevExtreme-compatible response
    return NextResponse.json({
      value: data,
      '@odata.count': totalCount
    })

  } catch (error) {
    console.error('${tableName} API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${tableName}' },
      { status: 500 }
    )
  }
}

function parseODataFilter(filter: string, businessId: number) {
  // Simplified OData filter parser
  // In production, use a proper OData parser library
  const whereClause: any = { businessId }
  
  // Basic string contains filters
  const containsRegex = /contains\\(([^,]+),\\s*'([^']+)'\\)/g
  let match
  
  while ((match = containsRegex.exec(filter)) !== null) {
    const field = match[1].trim()
    const value = match[2]
    whereClause[field] = { contains: value, mode: 'insensitive' }
  }
  
  return whereClause
}`;
}

/**
 * Generate React hook for remote data source
 */
function generateRemoteDataSourceHook(tableName) {
  return `import { useMemo } from 'react'
import DataSource from 'devextreme/data/data_source'
import CustomStore from 'devextreme/data/custom_store'

export function use${tableName.charAt(0).toUpperCase() + tableName.slice(1)}DataSource() {
  return useMemo(() => {
    return new DataSource({
      store: new CustomStore({
        key: 'id',
        load: async (loadOptions) => {
          try {
            const params = new URLSearchParams()
            
            // Pagination
            if (loadOptions.skip) {
              params.append('$skip', loadOptions.skip.toString())
            }
            if (loadOptions.take) {
              params.append('$top', loadOptions.take.toString())
            }
            
            // Sorting
            if (loadOptions.sort && loadOptions.sort.length > 0) {
              const sort = loadOptions.sort[0]
              params.append('$orderby', \`\${sort.selector} \${sort.desc ? 'desc' : 'asc'}\`)
            }
            
            // Filtering
            if (loadOptions.filter) {
              params.append('$filter', loadOptions.filter)
            }
            
            // Search
            if (loadOptions.searchValue) {
              params.append('$search', loadOptions.searchValue)
            }

            const response = await fetch(\`/api/${tableName}?\${params.toString()}\`)
            
            if (!response.ok) {
              throw new Error('Failed to fetch data')
            }
            
            const result = await response.json()
            
            return {
              data: result.value,
              totalCount: result['@odata.count']
            }
          } catch (error) {
            console.error('Error loading ${tableName}:', error)
            throw error
          }
        }
      }),
      paginate: true,
      pageSize: 20,
      pageSizes: [10, 20, 50, 100]
    })
  }, [])
}`;
}

/**
 * Optimize a file with DataGrid components
 */
function optimizeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const configs = extractDataGridConfig(content);

  if (configs.length === 0) {
    return { file: filePath, optimizations: [], optimized: false };
  }

  const optimizations = [];
  let optimizedContent = content;

  // Extract table name from file path
  const pathParts = filePath.split('/');
  const fileName = pathParts[pathParts.length - 1].replace('.tsx', '').replace('.ts', '');
  const tableName = fileName.replace('-', '').toLowerCase();

  configs.forEach((config, index) => {
    const optimizedGrid = generateOptimizedDataGrid(config, tableName);
    optimizedContent = optimizedContent.replace(config.fullMatch, optimizedGrid);

    optimizations.push({
      type: 'datagrid-remote',
      tableName,
      columns: config.columns,
      before: config.fullMatch,
      after: optimizedGrid
    });
  });

  // Add remote data source hook
  const hookImport = `import { use${tableName.charAt(0).toUpperCase() + tableName.slice(1)}DataSource } from '@/hooks/use${tableName}DataSource'`;
  const hookUsage = `const dataSource = use${tableName.charAt(0).toUpperCase() + tableName.slice(1)}DataSource();`;

  if (!optimizedContent.includes(hookImport)) {
    optimizedContent = optimizedContent.replace(
      /import.*from.*devextreme-react.*\n/,
      `$&${hookImport}\n`
    );
  }

  if (!optimizedContent.includes(hookUsage)) {
    // Add hook usage before the component return
    optimizedContent = optimizedContent.replace(
      /(export default function \w+\(\) \{[\s\S]*?)(return)/,
      `$1  ${hookUsage}\n\n  $2`
    );
  }

  return {
    file: filePath,
    optimizations,
    optimized: optimizations.length > 0,
    content: optimizedContent
  };
}

/**
 * Generate API handlers for all tables
 */
function generateApiHandlers(results) {
  const apiHandlers = new Map();

  results.forEach(result => {
    if (result.optimized) {
      result.optimizations.forEach(opt => {
        if (opt.type === 'datagrid-remote') {
          const tableName = opt.tableName;
          if (!apiHandlers.has(tableName)) {
            apiHandlers.set(tableName, {
              tableName,
              columns: opt.columns,
              handler: generateApiHandler(tableName, opt.columns)
            });
          }
        }
      });
    }
  });

  return Array.from(apiHandlers.values());
}

/**
 * Generate React hooks for all tables
 */
function generateReactHooks(results) {
  const hooks = new Map();

  results.forEach(result => {
    if (result.optimized) {
      result.optimizations.forEach(opt => {
        if (opt.type === 'datagrid-remote') {
          const tableName = opt.tableName;
          if (!hooks.has(tableName)) {
            hooks.set(tableName, {
              tableName,
              hook: generateRemoteDataSourceHook(tableName)
            });
          }
        }
      });
    }
  });

  return Array.from(hooks.values());
}

/**
 * Main optimization process
 */
function main() {
  console.log('🔍 Finding DevExtreme DataGrid files...');
  const files = findDataGridFiles(DASHBOARD_DIR);
  console.log(`Found ${files.length} files with DataGrid components`);

  console.log('⚡ Converting to remote operations...');
  const results = files.map(filePath => {
    try {
      return optimizeFile(filePath);
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
      return { file: filePath, optimizations: [], optimized: false, error: error.message };
    }
  });

  // Save optimized files
  results.forEach(result => {
    if (result.optimized && result.content) {
      const relativePath = path.relative(DASHBOARD_DIR, result.file);
      const outputPath = path.join(OUTPUT_DIR, 'components', relativePath);
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, result.content);
    }
  });

  // Generate API handlers
  const apiHandlers = generateApiHandlers(results);
  apiHandlers.forEach(handler => {
    const apiPath = path.join(OUTPUT_DIR, 'api', handler.tableName, 'route.ts');
    const apiDir = path.dirname(apiPath);

    if (!fs.existsSync(apiDir)) {
      fs.mkdirSync(apiDir, { recursive: true });
    }

    fs.writeFileSync(apiPath, handler.handler);
  });

  // Generate React hooks
  const hooks = generateReactHooks(results);
  hooks.forEach(hook => {
    const hookPath = path.join(OUTPUT_DIR, 'hooks', `use${hook.tableName.charAt(0).toUpperCase() + hook.tableName.slice(1)}DataSource.ts`);
    const hookDir = path.dirname(hookPath);

    if (!fs.existsSync(hookDir)) {
      fs.mkdirSync(hookDir, { recursive: true });
    }

    fs.writeFileSync(hookPath, hook.hook);
  });

  // Generate report
  const report = {
    summary: {
      filesProcessed: results.length,
      filesOptimized: results.filter(r => r.optimized).length,
      totalOptimizations: results.reduce((sum, r) => sum + r.optimizations.length, 0),
      apiHandlersGenerated: apiHandlers.length,
      hooksGenerated: hooks.length
    },
    optimizations: results.filter(r => r.optimized).map(r => ({
      file: r.file,
      optimizations: r.optimizations
    })),
    apiHandlers: apiHandlers.map(h => h.tableName),
    hooks: hooks.map(h => h.tableName)
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'devextreme-remote-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log('✅ DevExtreme remote operations optimization complete!');
  console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
  console.log(`📊 Processed ${files.length} files`);
  console.log(`⚡ Optimized ${report.summary.filesOptimized} files`);
  console.log(`🔄 Made ${report.summary.totalOptimizations} optimizations`);
  console.log(`🌐 Generated ${apiHandlers.length} API handlers`);
  console.log(`🎣 Generated ${hooks.length} React hooks`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  findDataGridFiles,
  extractDataGridConfig,
  generateRemoteDataSource,
  generateOptimizedDataGrid,
  generateApiHandler,
  generateRemoteDataSourceHook,
  optimizeFile
};
