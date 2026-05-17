# Спецификация Характеристик И Фильтров Soliton

Дата: 2026-05-14.

SDD feature: `specs/004-product-catalog-foundation`.

## Attribute Principles

Характеристики нужны для пяти задач:

- фильтры категорий;
- бейджи в карточках и листингах;
- таблицы характеристик;
- SEO-посадочные;
- проверка claims и технической точности.

Правила:

- фильтры строятся только на controlled values;
- raw specs сохраняются отдельно;
- не применять product-dependent характеристики ко всей категории;
- не смешивать Schuko, IEC C13, IEC C19 и входные разъемы;
- ток, напряжение, фазность и мощность должны храниться раздельно.

## Attribute Groups

## 1. Identity

Fields:

- `sku`;
- `product_family`;
- `model_series`;
- `product_type`;
- `configuration_type`.

Controlled values:

- `rack_pdu`;
- `socket_block`;
- `surge_filter`;
- `monitoring_controller`;
- `accessory`;
- `system_or_family`.

## 2. Form Factor And Mounting

Fields:

- `rack_size`;
- `unit_height`;
- `mounting_orientation`;
- `zero_u_compatible`;
- `rack_height_fit`;

Controlled values:

- rack_size: `10_inch`, `19_inch`;
- unit_height: `1U`, `0U`, `42U`, `custom`;
- mounting_orientation: `horizontal`, `vertical`, `universal`;
- zero_u_compatible: `yes`, `no`, `optional`, `unknown`.

Filter use:

- 19";
- 10";
- 1U;
- вертикальные PDU;
- 0U/42U.

## 3. Electrical Rating

Fields:

- `nominal_current_a`;
- `nominal_voltage_v`;
- `max_power_kw`;
- `phase_count`;
- `frequency_hz`;

Controlled values:

- current: `10A`, `16A`, `20A`, `32A`;
- voltage: `250V`, `400V`;
- phase_count: `1_phase`, `3_phase`.

Filter use:

- 16A;
- 32A;
- трехфазные PDU.

Rules:

- Do not calculate power unless voltage/current/phase are known.
- Preserve source power strings where uncertain.

## 4. Outlet Types And Counts

Fields:

- `outlet_types`;
- `outlet_count_total`;
- `outlet_count_schuko`;
- `outlet_count_c13`;
- `outlet_count_c19`;
- `outlet_layout`;

Controlled values:

- `Schuko`;
- `IEC C13`;
- `IEC C19`;
- `combined`;
- `terminal_block`;

Filter use:

- Schuko;
- IEC C13;
- IEC C19;
- C13+C19.

Badge examples:

- `8 Schuko`;
- `16 C13`;
- `2 C19`;
- `C13+C19`.

## 5. Input Connection

Fields:

- `input_type`;
- `input_plug`;
- `input_connector`;
- `cable_length_m`;
- `cable_cross_section`;

Controlled values:

- `Schuko plug`;
- `IEC C14`;
- `IEC C20`;
- `IEC 60309 16A`;
- `IEC 60309 32A`;
- `terminal_block`;
- `custom`;

## 6. Protection And Switching

Fields:

- `has_switch`;
- `switch_type`;
- `has_overcurrent_protection`;
- `protection_type`;
- `has_rcd`;
- `has_surge_protection`;
- `has_emi_filter`;

Controlled values:

- switch: `none`, `single`, `two_pole`, `illuminated`;
- protection: `AB`, `BA47`, `RCD`, `UZIP`, `EMI_filter`, `fuse`, `unknown`.

Filter use:

- с выключателем;
- с автоматом/защитой;
- с УЗО;
- с УЗИП;
- сетевой фильтр.

## 7. Monitoring And Control

Fields:

- `has_metering`;
- `metered_parameters`;
- `has_network_monitoring`;
- `has_outlet_control`;
- `protocols`;
- `interface`;
- `environment_monitoring`;

Controlled values:

- metered parameters: `voltage`, `current`, `power`, `energy`;
- protocols: `SNMP`, `WEB`, `Ethernet`;
- control: `none`, `unit_level`, `outlet_level`, `unknown`.

Filter use:

- измерительные PDU;
- PDU с мониторингом;
- управляемые PDU;
- SNMP PDU.

Claim control:

- Do not show monitoring/control badges unless product data explicitly supports them.

## 8. Physical Characteristics

Fields:

- `body_material`;
- `color`;
- `ral_color`;
- `length_mm`;
- `width_mm`;
- `height_mm`;
- `mounting_length_mm`;
- `body_profile`.

Controlled values:

- material: `aluminum`, `steel`, `metal`, `plastic`, `unknown`;
- color: `black`, `grey`, `custom`;
- RAL: e.g. `RAL9005`.

## 9. Documentation And Proof

Fields:

- `has_passport`;
- `has_manual`;
- `has_certificate`;
- `has_registry_record`;
- `has_datasheet`;
- `has_drawing`;
- `proof_status`;

Filter/display use:

- document badges;
- B2B proof blocks;
- registry trust blocks.

## 10. SEO And Page Mapping

Fields:

- `primary_query_cluster`;
- `secondary_query_clusters`;
- `seo_landing_eligible`;
- `recommended_landing_pages`;
- `badge_priority`;

Examples:

- `pdu_19_1u`;
- `schuko_pdu`;
- `iec_c13_pdu`;
- `vertical_pdu`;
- `metered_pdu`;
- `server_rack_pdu`.

## 11. Commerce And Availability

Fields:

- `price_status`;
- `stock_status`;
- `rfq_enabled`;
- `purchase_enabled`;
- `lead_time_status`;

Controlled values:

- price_status: `shown`, `on_request`, `outdated`, `hidden`;
- stock_status: `in_stock`, `by_request`, `on_order`, `unknown`, `out_of_stock`.

## 12. Logistics And Fiscal

Fields:

- `weight_kg`;
- `package_dimensions`;
- `pickup_point_eligible`;
- `freight_required`;
- `vat_rate`;
- `receipt_name`;
- `unit_name`.

Display use:

- delivery eligibility;
- checkout;
- 54-ФЗ;
- logistics integrations.

## Filter And Badge Mapping

| UI Filter | Attribute fields | Badge example |
|---|---|---|
| Монтаж | rack_size, unit_height, mounting_orientation | `19"`, `1U`, `вертикальный` |
| Ток | nominal_current_a | `16A`, `32A` |
| Напряжение | nominal_voltage_v | `250V`, `400V` |
| Фазность | phase_count | `1 фаза`, `3 фазы` |
| Тип розеток | outlet_types | `Schuko`, `IEC C13`, `IEC C19` |
| Количество розеток | outlet_count_* | `8 розеток`, `16 C13` |
| Вход | input_type, input_plug | `IEC C20`, `IEC 60309` |
| Защита | protection fields | `АВ`, `УЗО`, `УЗИП` |
| Мониторинг | monitoring fields | `U/I/P`, `SNMP`, `WEB` |
| Управление | control fields | `управляемый` |

## Product Page Table Grouping

Groups:

1. Назначение и тип.
2. Электрические параметры.
3. Розетки.
4. Вход и кабель.
5. Монтаж и корпус.
6. Защита.
7. Мониторинг и управление.
8. Документы.
9. Доставка и упаковка.

## SEO Landing Mapping

| SEO Landing | Required attributes |
|---|---|
| PDU 19" | rack_size = `19_inch` |
| Блок розеток 1U | unit_height = `1U` |
| PDU Schuko | outlet_types contains `Schuko` |
| PDU IEC C13 | outlet_types contains `IEC C13` |
| PDU IEC C19 | outlet_types contains `IEC C19` |
| PDU 16A | nominal_current_a = `16A` |
| PDU 32A | nominal_current_a = `32A` |
| Вертикальные PDU | mounting_orientation = `vertical` |
| Трехфазные PDU | phase_count = `3_phase` |
| PDU с мониторингом | has_metering or has_network_monitoring |
| Управляемые PDU | has_outlet_control or control != `none` |
| Сетевые фильтры с УЗИП | has_surge_protection |

## Claim/Proof Mapping

| Claim | Required data |
|---|---|
| Российское производство | made_in_russia_status, product_line scope |
| Реестр | registry_record document, registry_number |
| Надежность | warranty, cases, reviews, repeated supply evidence |
| Защита | protection_type, document/passport |
| Мониторинг | metered_parameters, interface/protocol |
| Управление | control type, documentation |
| Сопоставимость с APC/APS | approved testimonial or controlled comparison evidence |

## Open Attribute Gaps

Need enrichment:

- exact outlet counts for all products;
- input connector for all products;
- cable length for all products;
- dimensions and weight;
- protection type normalization;
- documents classification;
- monitoring/control capabilities per SKU;
- registry and Russian production scope.
