import type { Session, SessionUser } from "@openvz/auth";
import type { Request } from "express";

export type BaseTrpcContext = {
	req?: Request;
	session: Session | null;
};

export type AuthedTrpcContext = BaseTrpcContext & {
	user: SessionUser;
};
