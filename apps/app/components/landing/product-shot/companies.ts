export type MockCompany = {
	name: string;
	domain: string;
	self?: boolean;
	industry?: string;
	owner?: { name: string };
	contacts?: string;
	deals?: string;
	lastActivity?: string;
};

export const OWNER = {
	name: "Wei Lin",
};

export const MOCK_COMPANIES: MockCompany[] = [
	{
		name: "OPENVZ AI",
		domain: "openvzai.com",
		self: true,
		industry: "Software & AI",
		owner: OWNER,
		contacts: "1",
		deals: "0",
		lastActivity: "2h ago",
	},
	{ name: "Northwind Logistics", domain: "northwind-logistics.com" },
	{ name: "Fernhill Analytics", domain: "fernhill.io" },
	{ name: "Halcyon Robotics", domain: "halcyonrobotics.com" },
	{ name: "Meridian Health", domain: "meridianhealth.co" },
	{ name: "Brightpath Capital", domain: "brightpathcapital.com" },
	{ name: "Cobalt Foundry", domain: "cobaltfoundry.dev" },
	{ name: "Silverline Retail", domain: "silverlineretail.com" },
];

export const COMPANY_COLUMNS = [
	{ label: "Company", width: "26%" },
	{ label: "Domain", width: "16%" },
	{ label: "Industry", width: "16%" },
	{ label: "Owner", width: "16%" },
	{ label: "Contacts", width: "9%" },
	{ label: "Deals", width: "9%" },
	{ label: "Last activity", width: "12%" },
] as const;
