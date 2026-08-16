import type { ActivityType } from "@openvz/db/enums";
import { Icon } from "@openvz/ui/components/icon";
import { activityIcon } from "@/lib/activity-presentation";

export function ActivityIcon({ type }: { type: ActivityType }) {
	return <Icon icon={activityIcon(type)} />;
}
