import type * as React from "react";

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		aria-label="OPENVZ AI Logo"
		{...props}
	>
		<g fill="currentColor">
			<rect x={222} y={40} width={68} height={432} rx={34} />
			<rect
				x={222}
				y={40}
				width={68}
				height={432}
				rx={34}
				transform="rotate(60 256 256)"
			/>
			<rect
				x={222}
				y={40}
				width={68}
				height={432}
				rx={34}
				transform="rotate(120 256 256)"
			/>
		</g>
	</svg>
);
export default Logo;
