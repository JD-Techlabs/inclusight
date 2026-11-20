# Accessibility statement for {{ property.name | md }}

{{ organisationName | md }} is committed to making {{ property.name | md }} ({{ property.url | md }}) accessible to everyone, including persons with disabilities, in line with the Rights of Persons with Disabilities Act, 2016 and SEBI's digital accessibility requirements.

## Conformance status

**{{ conformance.level | md }}.** {{ conformance.sentence | md }}

## Standard

We aim to meet {{ standard | md }}.

## Known limitations
{% if limitations.size == 0 and extraLimitations.size == 0 %}
We are not aware of any accessibility limitations at present.
{% else %}
We know about the following problems and are working to fix them:
{% for l in limitations %}
- **{{ l.criterion | md }}:** {{ l.description | md }}
{%- endfor %}
{% for paragraph in extraLimitations %}
{{ paragraph | md }}
{% endfor %}
{%- endif %}

## How we assessed this website

{{ method | md }}

## Feedback and contact

If you find an accessibility problem on this website or need information in another format, contact us by email at <{{ contact.email }}>{% if contact.phone != "" %} or by phone on {{ contact.phone | md }}{% endif %}. We aim to respond within {{ contact.responseDays }} working days.

## Date of this statement

This statement was prepared on {{ preparedOn | md }}.
