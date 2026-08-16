import Logo from "@openvz/ui/components/logo";
import { initialsFromName } from "@openvz/ui/lib/format";
import type { MockCompany } from "./companies";

export function CompanyMark({
	company,
	size,
	glyph,
}: {
	company: Pick<MockCompany, "name" | "self">;
	size: number;
	glyph: number;
}) {
	if (company.self) {
		return (
			<span
				className="flex shrink-0 items-center justify-center bg-foreground"
				style={{ width: size, height: size }}
			>
				<Logo
					className="shrink-0 text-background"
					style={{ width: glyph, height: glyph }}
				/>
			</span>
		);
	}

	return (
		<span
			className="flex shrink-0 items-center justify-center bg-muted font-medium text-muted-foreground"
			style={{ width: size, height: size, fontSize: glyph }}
		>
			{initialsFromName(company.name)}
		</span>
	);
}
