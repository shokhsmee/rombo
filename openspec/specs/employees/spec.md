# employees

## Purpose
HR card for each staff member. Referenced as manager of clients and Loyihalar; later as buyer, foreman, installer.

## Requirements

### Requirement: Employee record
Auto code `XD-NNNN`; last/first/middle name; phone; email; department; position; hire/birth date; status `active | on_leave | dismissed`; address; notes.

### Requirement: Optional login link
An employee MAY link to one user and a user to at most one employee.

#### Scenario: User already linked
- WHEN linking a user that belongs to another employee
- THEN 409 on field `user_id`

### Requirement: List and search
`GET /employees/` searches code, names, phone, position, department; filters `status`, `department`; `GET /employees/departments/` lists distinct departments.

### Requirement: Archive
Delete SHALL soft-delete and release the user link.
