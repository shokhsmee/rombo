## ADDED Requirements

### Requirement: Constructor pages
The registry SHALL have `constructions` "Konstruksiyalar" (group "Savdo", all actions) and `profile_systems`
"Profil tizimlari" (group "Sozlamalar", all actions). Roles that can update Loyihas get `constructions` view,
create, update and delete; `profile_systems` changes are for Administrator and the production head.

#### Scenario: Sales edits a profile system
- WHEN a user with only `profile_systems.view` saves a profile system
- THEN 403
