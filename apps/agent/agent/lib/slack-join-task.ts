import { parse, schemas } from "@openvz/validation";
import { joinSlackChannel } from "./slack-membership";

export async function runSlackChannelJoin(value: unknown): Promise<string> {
	const { channelId, channelName } = parse(
		schemas.slack.joinPayload,
		value,
		"A slack-channel-join task carries an unreadable payload",
	);
	const outcome = await joinSlackChannel(channelId);

	if (outcome.joined) {
		return outcome.already
			? `OPENVZ AI was already in #${channelName}.`
			: `OPENVZ AI joined #${channelName}.`;
	}

	return `OPENVZ AI could not join #${channelName}. ${outcome.reason}`;
}
