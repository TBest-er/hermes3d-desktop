# Hermes3D Desktop plugin

Adds a **Hermes3D** row to the Hermes Desktop sidebar and a palette command
that opens the Hermes3D 3D office (Hermes3D Studio web app) in a full page.

The office server itself is Hermes3D (https://github.com/iamlukethedev/Hermes3D),
run separately and connected to a hermes-agent gateway; this plugin only
embeds it. The embedded URL defaults to http://127.0.0.1:3000 and is editable
in the page toolbar (persisted).

Desktop-only half: `desktop/plugin.js`, no agent-side code.
