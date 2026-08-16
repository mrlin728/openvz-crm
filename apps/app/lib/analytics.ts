export const ANALYTICS_HOSTS: readonly string[] = [
	"crm.openvzai.com",
	"www.openvzai.com",
];

export function analyticsAllowed(hostname: string): boolean {
	return ANALYTICS_HOSTS.includes(hostname.trim().toLowerCase());
}
