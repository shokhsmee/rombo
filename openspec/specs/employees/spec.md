# employees

## Purpose
HR card for each staff member. Referenced as manager of clients and Loyihalar; later as buyer, foreman, installer.

## Requirements

### Requirement: Employee record
Auto code `XD-NNNN`; last/first/middle name; phone; email; department; position; hire/birth date; status `active | on_leave | dismissed`; address; notes.

#### Scenario: Code on create
- WHEN an employee is created
- THEN it gets the next code `XD-NNNN`

### Requirement: Optional login link
An employee MAY link to one user and a user to at most one employee.

#### Scenario: User already linked
- WHEN linking a user that belongs to another employee
- THEN 409 on field `user_id`

### Requirement: List and search
`GET /employees/` searches code, names, phone, position, department; filters `status`, `department`; `GET /employees/departments/` lists distinct departments.

#### Scenario: Search by position
- WHEN `GET /employees/?q=usta` is called
- THEN employees whose code, name, phone, position or department contain `usta` are returned

### Requirement: Archive
Delete SHALL soft-delete and release the user link.

#### Scenario: Employee with a login
- WHEN an employee linked to a user is deleted
- THEN the employee is soft-deleted and the user can be linked to someone else
