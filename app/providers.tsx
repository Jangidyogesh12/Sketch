// app/providers.tsx
"use client"

import { InkProvider } from "@/lib/ink/react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <InkProvider textures={["fibre", "relief", "cloud", "linen"]}>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </InkProvider>
  )
}
