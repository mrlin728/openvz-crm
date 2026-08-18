"use client";

import { signIn, signUp } from "@openvz/auth/client";
import { Button } from "@openvz/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@openvz/ui/components/field";
import { Input } from "@openvz/ui/components/input";
import { Spinner } from "@openvz/ui/components/spinner";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

const MINIMUM_PASSWORD = 8;

export function PasswordSignIn({ create }: { create: boolean }) {
	const nameId = useId();
	const emailId = useId();
	const passwordId = useId();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);

		const { error } = create
			? await signUp.email({ name: name.trim(), email: email.trim(), password })
			: await signIn.email({ email: email.trim(), password });

		if (error) {
			setPending(false);
			toast.error(error.message ?? "Could not sign in.");
			return;
		}

		window.location.assign("/");
	}

	return (
		<form
			className="flex flex-col gap-6"
			onSubmit={(event) => {
				submit(event).catch(() => {
					setPending(false);
					toast.error("Could not reach the sign-in service.");
				});
			}}
		>
			<FieldGroup>
				{create ? (
					<Field>
						<FieldLabel htmlFor={nameId}>Your name</FieldLabel>
						<Input
							autoComplete="name"
							id={nameId}
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</Field>
				) : null}

				<Field>
					<FieldLabel htmlFor={emailId}>Email</FieldLabel>
					<Input
						autoComplete="username"
						id={emailId}
						onChange={(event) => setEmail(event.target.value)}
						required
						type="email"
						value={email}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={passwordId}>Password</FieldLabel>
					<Input
						autoComplete={create ? "new-password" : "current-password"}
						id={passwordId}
						minLength={MINIMUM_PASSWORD}
						onChange={(event) => setPassword(event.target.value)}
						required
						type="password"
						value={password}
					/>
					{create ? (
						<FieldDescription>
							At least {MINIMUM_PASSWORD} characters. It is stored on this
							computer only, and there is no way to reset it by email.
						</FieldDescription>
					) : null}
				</Field>
			</FieldGroup>

			<Button className="w-full" disabled={pending} type="submit">
				{pending ? <Spinner data-icon="inline-start" /> : null}
				{create ? "Create account" : "Sign in"}
			</Button>
		</form>
	);
}
