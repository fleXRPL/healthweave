/**
 * Realistic LLM response fixtures for testing the parsing layer.
 * These mirror actual Bedrock / Ollama output formats.
 */

export const MARKDOWN_HEADING_RESPONSE = `
## AI Summary

The patient is a 53-year-old male with a complex history including CLL, MTHFR mutation, and MASH F3 liver disease. Lab results show thrombocytopenia and elevated liver enzymes consistent with known conditions.

## Key Findings

1. Platelet count at 87 K/uL — below normal range (150–400)
2. ALT elevated at 62 U/L — consistent with MASH F3
3. Hemoglobin at 11.2 g/dL — mild anemia
4. WBC at 14.3 K/uL — elevated, consistent with CLL

## Clinical Correlations

The thrombocytopenia is likely multifactorial: CLL-related bone marrow involvement and portal hypertension from MASH F3. The mild anemia may reflect chronic disease or CLL progression.

## Recommendations

1. Follow up with hematology regarding CLL progression
2. Repeat LFTs in 3 months
3. Consider GI referral for portal hypertension evaluation

## Uncertainties and Limitations

Full bone marrow biopsy results not available. Imaging not included in current documents.

## Questions for Your Doctor

1. Should aspirin be held before upcoming procedures given thrombocytopenia?
2. Is the elevated WBC consistent with current CLL staging?

## Key Values (Quick Reference)

| Test | Value | Unit | Reference |
|------|-------|------|-----------|
| Platelets | 87 | K/uL | 150–400 |
| ALT | 62 | U/L | 7–56 |
| Hemoglobin | 11.2 | g/dL | 13.5–17.5 |
| WBC | 14.3 | K/uL | 4.5–11.0 |
`;

export const BOLD_HEADER_RESPONSE = `
**AI Summary**: The patient presents with multiple comorbidities requiring coordinated care.

**Key Findings**:
- Platelet count critically low at 87 K/uL
- Liver enzymes mildly elevated

**Recommendations**:
- Hematology follow-up recommended
- Repeat CBC in 4 weeks
`;

export const PLAIN_HEADER_RESPONSE = `
AI Summary:
The patient has a complex multi-system history.

Key Findings:
1. Low platelets
2. Elevated liver enzymes

Recommendations:
1. Follow up with specialist
`;

export const BOLD_STRUCTURED_FINDINGS = `
## Key Findings

**Thrombocytopenia:** Platelet count at 87 K/uL is below normal, likely related to CLL and portal hypertension.
**Elevated ALT:** At 62 U/L, consistent with known MASH F3 liver disease.
**Mild Anemia:** Hemoglobin 11.2 g/dL suggests chronic disease anemia.
`;

export const EMPTY_RESPONSE = '';

export const RESPONSE_WITHOUT_SECTIONS = `
This is a plain text response with no markdown headers or structured sections.
It contains some information but nothing parseable.
`;
