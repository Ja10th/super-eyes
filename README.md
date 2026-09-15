# super-eyes

## Manual worker control

The Automations screen's `run worker now` button dispatches `.github/workflows/render-worker.yml` through the server. Configure `GITHUB_TOKEN` with Actions write permission on the deployed server, plus `GITHUB_REPOSITORY` and `GITHUB_WORKFLOW_REF` if the defaults (`Ja10th/super-eyes` and `main`) do not apply.
