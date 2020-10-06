# value 
1. what led us to decide to make this? 
2. why is this useful for our users? 
3. what alternatives were considered?

# behavior
## happy path
include:
- command response, if present
- notifications - how does the behavior look like for other users?

* GIVEN ...
  * WHEN ...
  * THEN ...
  * AND THEN ...

[example issue](https://0xacab.org/team-friendo/signalboost/-/issues/100)

## sad path
common gotchas:
- [ ] starting a sentence with the command
- [ ] typos!
- [ ] someone in the wrong role (i.e. subscriber/admin/random person) tries to use the command

# implementation
this section is optional! 

considerations:
- [ ] data model changes
- [ ] any new abstractions introduced with summaries of their interfaces and how they interact
- [ ] any considerations about performance or security to keep in mind
- [ ] any discarded alternatives and why
- [ ] anything definitively out of scope 