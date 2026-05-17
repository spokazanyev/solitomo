# Data Model: Competitor Conversion Research

Дата: 2026-05-14.

## Competitor Source

Represents one reviewed page or supplier source.

Fields:

- `name` - company or product family name.
- `url` - reviewed source URL.
- `market_type` - global manufacturer, Russian supplier, ecommerce seller, benchmark.
- `page_type` - product family, product detail, category, solution page, documentation page.
- `observed_focus` - main message or page purpose.
- `notes` - factual observations.

## Marketing Pattern

Represents a reusable message or selling mechanism.

Fields:

- `pattern_name`;
- `description`;
- `seen_on`;
- `buyer_need`;
- `page_type_fit`;
- `soliton_use`;
- `proof_status`.

Proof status values:

- `safe_now`;
- `requires_proof`;
- `product_dependent`;
- `avoid`.

## Visual Pattern

Represents a reusable layout, component, or UX pattern.

Fields:

- `pattern_name`;
- `description`;
- `seen_on`;
- `page_type_fit`;
- `implementation_implication`;

## Copywriting Pattern

Represents a reusable copy structure, not exact wording.

Fields:

- `pattern_name`;
- `message_structure`;
- `technical_depth`;
- `target_audience`;
- `soliton_adaptation`;
- `claim_control`;

## Soliton Recommendation

Represents a concrete action for later specs.

Fields:

- `recommendation`;
- `page_type`;
- `priority`;
- `source_patterns`;
- `why_it_matters`;
- `proof_needed`;
- `next_spec`;

## Claim Control

Represents how factual statements should be treated.

Fields:

- `claim`;
- `status`;
- `required_evidence`;
- `allowed_page_types`;
- `notes`;
