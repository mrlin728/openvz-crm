"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@openvz/ui/components/accordion";
import { Shimmer } from "@openvz/ui/components/shimmer";
import { cn } from "@openvz/ui/lib/utils";
import type { ReactNode } from "react";

export function Reasoning({
	children,
	className,
	isStreaming = false,
	label = "Reasoning",
}: {
	children: ReactNode;
	className?: string;
	isStreaming?: boolean;
	label?: string;
}) {
	return (
		<Accordion
			key={isStreaming ? "streaming" : "settled"}
			type="single"
			collapsible
			defaultValue={isStreaming ? "reasoning" : undefined}
			className={cn(className)}
		>
			<AccordionItem value="reasoning">
				<AccordionTrigger variant="subtle">
					{isStreaming ? <Shimmer>Thinking…</Shimmer> : label}
				</AccordionTrigger>
				<AccordionContent className="text-muted-foreground">
					{children}
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
