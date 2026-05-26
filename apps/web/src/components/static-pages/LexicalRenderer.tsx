import { RichText } from "@payloadcms/richtext-lexical/react";

import type { StaticPageDoc } from "@/lib/static-pages/get-static-page";

type Props = {
  body: StaticPageDoc["body"];
};

/**
 * Server Component that renders a Payload Lexical rich-text JSON tree
 * using the official `@payloadcms/richtext-lexical/react` `RichText`
 * component. Tailwind `prose` styling is applied by the parent
 * `<article>` so this component only emits the semantic markup.
 */
export function LexicalRenderer({ body }: Props) {
  if (!body) return null;
  // `body` is the Lexical SerializedEditorState produced by Payload's
  // richText field. The exact generated type is not exported here, so we
  // bridge via `never` — the runtime contract is enforced by Payload.
  return <RichText data={body as never} />;
}
