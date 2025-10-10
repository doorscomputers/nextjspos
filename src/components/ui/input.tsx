import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border-2 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition-all duration-200 outline-none",
        "border-gray-300 dark:border-gray-600",
        "placeholder:text-gray-500 dark:placeholder:text-gray-400",
        "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/30",
        "hover:border-gray-400 dark:hover:border-gray-500",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900",
        "aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/30",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-900 dark:file:text-gray-100",
        "selection:bg-blue-500 selection:text-white",
        className
      )}
      {...props}
    />
  )
}

export { Input }
