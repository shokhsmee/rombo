# Tasks: add-quick-create-client

- [x] `EntitySelect`: `onCreate` / `onCreateEdit` props, create rows at the end of the dropdown, keyboard
      support (ArrowDown reaches them, Enter picks)
- [x] `QuickCreateClient` dialog (kind, name, phone, region, address, STIR) using `clientsApi.useSave`
      (no nested `<form>`: the dialog lives inside the Loyiha form)
- [x] Loyiha form: wire both options on the Mijoz field, hide without `clients.create`, select the result
- [x] Browser check: type an unknown name → both rows; quick create selects; dialog creates and selects
- [x] `npm run build`; archive, CHANGELOG
