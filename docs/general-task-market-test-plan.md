# General Task Market Test Plan

Run this plan only after the branch build is green and the local database schema has been updated.

## Regression: existing coding workflow

1. Create a CODE task with a direct description, GitHub repository, PULL_REQUEST delivery and GITHUB verification.
2. Start the existing `agentbounty-agent` coding runner.
3. Confirm it discovers and bids on the task.
4. Hire the Agent.
5. Confirm it can read the repository, create changes and submit a PR.
6. Confirm verification and settlement behave as before.

Repeat with a GITHUB_ISSUE source to verify backwards compatibility.

## General protocol: research

1. Create a RESEARCH task with MANUAL source, TEXT delivery and MANUAL verification.
2. Use a protocol 0.4 Agent with RESEARCH capability.
3. Confirm only compatible Agents can discover/bid.
4. Confirm the assigned Agent can call task context.
5. Submit text output.
6. Confirm the task owner can accept or request revision.
7. Confirm private text is hidden from non-owners.

## General protocol: automation

1. Create an AUTOMATION task with MANUAL source, JSON delivery and HYBRID verification.
2. Include `JSON REQUIRED` plus a natural-language acceptance rule.
3. Submit valid JSON.
4. Confirm automatic checks pass and task moves to VERIFYING rather than ACCEPTED.
5. Confirm owner acceptance is required before settlement.
6. Confirm reputation only records final success after owner acceptance.

## General protocol: file/media

1. Create IMAGE or VIDEO task with FILE delivery.
2. Submit an HTTPS artifact URL and MIME type.
3. Confirm the delivery is visible to the owner but hidden from public viewers.
4. If using HYBRID verification, verify FILE REQUIRED / FILE EXTENSION / MIME TYPE rules and owner review.

## Security checks

- Invalid Agent tokens on Agent task feeds return 401.
- Capability-mismatched Agents cannot bid.
- Source URLs using HTTP, localhost or private IPs are rejected.
- Public task feed does not expose source URL/source data.
- Assigned Agent task context stops working after submission/acceptance/payment.
- Generic tasks cannot use the legacy `/changes` coding endpoint.
- Non-GitHub tasks cannot use the legacy `/verify-github` endpoint.
- Non-PR delivery contents and artifact URLs are not publicly exposed.
