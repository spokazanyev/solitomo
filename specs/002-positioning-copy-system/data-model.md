# Data Model: Positioning Copy System

Дата: 2026-05-14.

## Audience Segment

Represents a buyer group.

Fields:

- `name`;
- `role`;
- `needs`;
- `objections`;
- `decision_criteria`;
- `preferred_cta`;
- `proof_needed`.

## Message Pillar

Represents a core Soliton argument.

Fields:

- `pillar`;
- `meaning`;
- `buyer_value`;
- `approved_language`;
- `proof_requirement`;
- `page_types`.

## Copy Template

Represents reusable page copy structure.

Fields:

- `page_type`;
- `goal`;
- `required_blocks`;
- `seo_role`;
- `conversion_role`;
- `cta`;
- `proof_blocks`;
- `avoid`.

## Claim Rule

Represents publication control for claims.

Fields:

- `claim`;
- `risk`;
- `status`;
- `approved_safe_wording`;
- `required_evidence`;
- `notes`.

Status values:

- `safe_now`;
- `requires_proof`;
- `product_dependent`;
- `testimonial_dependent`;
- `avoid_until_confirmed`.

## CTA Pattern

Represents a reusable call-to-action.

Fields:

- `cta_text`;
- `intent`;
- `page_type`;
- `audience`;
- `stage`;
- `analytics_event`.

## Page Copy Rule

Represents rules for a page type.

Fields:

- `page_type`;
- `primary_audience`;
- `search_intent`;
- `message_hierarchy`;
- `required_terms`;
- `forbidden_terms`;
- `conversion_block`.
