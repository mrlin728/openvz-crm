import type { DealStage } from "@openvz/db/enums";
import { StatusIndicator } from "@openvz/ui/components/status-indicator";
import { dealStagePresentation } from "@/lib/deal-stage";

export function DealStageIndicator({
	stage,
	className,
}: {
	stage: DealStage;
	className?: string;
}) {
	const { label, tone } = dealStagePresentation(stage);
	return <StatusIndicator tone={tone} label={label} className={className} />;
}
