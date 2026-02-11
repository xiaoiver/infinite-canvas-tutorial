"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useTranslations } from "next-intl"
import { ChevronsDownUpIcon, ChevronsUpDownIcon } from "lucide-react"

export function CodeCollapsibleWrapper({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Collapsible>) {
  const [isOpened, setIsOpened] = React.useState(true)
  const t = useTranslations('common');
  return (
    <Collapsible
      open={isOpened}
      onOpenChange={setIsOpened}
      className={cn("group/collapsible relative", className)}
      {...props}
    >
      <CollapsibleTrigger asChild>
        <div className="absolute top-[-24px] right-0 z-10 flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground text-xs h-6 w-6"
          >
            {isOpened ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent
        forceMount
        className="relative overflow-hidden data-[state=closed]:max-h-20 data-[state=closed]:[content-visibility:auto] [&>figure]:mt-0 [&>figure]:md:!mx-0"
      >
        {children}
      </CollapsibleContent>
      <CollapsibleTrigger className="text-muted-foreground absolute inset-x-0 bottom-0 flex h-15 items-center justify-center rounded-b-lg bg-gradient-to-b from-transparent to-foreground/20 text-xs group-data-[state=open]/collapsible:hidden">
        {isOpened ? t('collapse') : t('expand')}
      </CollapsibleTrigger>
    </Collapsible>
  )
}