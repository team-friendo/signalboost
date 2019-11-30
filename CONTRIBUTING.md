# Table of Contents

1. [Community Guidelines](#guidelines)
1. [Opening Issues](#issues)
  1. [Feature Requests](#features)
  1. [Bug Reports](#bugs)
1. [Submitting Merge Requests](#mrs)
1. [Style preferences](#style)
1. [Talking to humans](#comms)

# Community Guidelines <a name="guidelines"></a>

Hi, we're so glad you're here! Team Friendo is trying to make software for liberation instead of exploitation and profit. As such, it is important to us that the principles of anti-oppression, consent, solidarity, empowerment, and autonomy that we want to see in the world are also present in the community we build to make the tools we want to put into the world.

We want everyone to be good to one another, we want to have clear definitions of what we think that means, and clear recourses you can take if you feel the community is not upholding its values in a way that makes you feel disempowered or unsafe.

Toward that end, we are currently drafting a code of conduct, which should be live shortly. You can read it in draft form here:

http://our.solidarity.camp/s/QMRYJJ9eLYCawby

As a baseline set of norms, we would also encourage you to read and abide by the Recurse Center Social Rules, the main point of which is to make people feel very safe asking questions and seeking help from others, which we'd really like to encourage here on Team Friendo:

https://www.recurse.com/social-rules

# Opening Issues <a name="issues"></a>

Before opening any issue, please check the project's [issue board](https://0xacab.org/team-friendo/signalboost/-/boards) to make sure somebody hasn't already requested the same thing. Maybe you could get the same effect by giving a :thumbs_up: to an already existing issue, or by adding your voice to the discussion about whether or not to implement another request! :)

### Feature Requests <a name="features"></a>

If you are reporting a feature request, please:

* tag the issue with a `Feature Request` tag so we can prioritize it alongside other feature requests
* Explain in as much detail as you can the social circumstances that cause you to want to have this feature
  * What goal were you trying to accomplish in the world?
  * Why was signalboost as designed incapable of accomplishing those goals?
  * Why are those goals particularly urgent for your group? Ie: why is it important to prioritize making this feature ahead of other features?
  * Here's an example: "We were sending out requests for people to sign up for roles for a march. But nobody could respond to sign up for roles. Can you add a way for subscribers?"
* Try to emphasize the human needs that the feature would address rather than the technical solution you envision meeting those needs
  * Ie: instead of "I want signalboost to auto-invite everyone in my contact list" say "I need a way to help people who don't know about signalboost join a channel I just made"
  * This style often more clearly illuminates the problem and in so doing, often leads to more creative/imaginative solutions than if we started by thinking of the solution first! :)

If you are on **Team Friendo** (or feel like being extra-helpful), please use this format:

```
# Value

{{ why is this feature important? who needs it in the world? why should we prioritize implementing it? }}

# Behavior

GIVEN {{ some preexisting set of conditions }}
* WHEN {{ some action is take }}
* THEN {{ some observable state change should occur }}

# Implementation Notes

{{ any technical details about how to implement the feature }}
{{ any data model changes you think it would be useful to spell out }}
{{ any definitions you found it useful to shorthand in the "Behavior" section }}
{{ any hidden complexity, context, or gotchas you think it would be useful to make explicit for someone coming to the issue without context }}

# Context

{{ anything we should explicitly descope??}}
{{ anything about the discussion with users that caused us to create this issue that might be non-obvious?? }}

```

Note that the "Behavior" section is intended to be written *excuslively* in user-facing terms. Anyone regardless of their technical background should be able to manually verify that an MR meeting the criteria in the "Behavior" section is done and can be shipped. If we were more jargon inclined, we would call this section "Acceptance Criteria."

If you don't have time to observe the above format, please mark your issue with `STUB` at the top. :)


### Bug Reports <a name="bugs"></a>

If you are reporting a bug, please:

* tag the issue with `Bug - unconfirmed` so we can prioritize trying to reproduce and fix it
* be as explicit as possible about the conditions under which you encountered the bug so that we can try to reproduce it
  * what were the steps you took just before the bug happened?
  * what message did you see when the bug happened?
  * what did you try to do in response to the bug and what happened then?
  * if you are a developer: do you have any logs you can share? what system were you running under and with what configurations?

If you are on **Team Friendo** (or feel like being extra-helpful), please use this format:

```
# Bug Description

* SYMTPOM: {{ describe user-facting symtpoms}}
* CAUSE: {{ cause if you have identified it, potential causes if you can't, or nothing if you have no idea }}
* FIX: {{ fix if you know it, potential fix if you have a guess, or nothing if you have no idea}}

# Desired Behavior

GIVEN {{ some preexisting set of conditions }}
* WHEN {{ some action is take }}
* THEN {{ some observable state change should occur }}
```

As with feature requests, the "Desired Behavior" section should be written in exclusively user-facing terms as much as possible.

# Submitting MRs <a name="mrs"></a>

Yay! Thanks for writing code to help the project! To help us keep track of things, please observe the following git conventions:

* **use issues:** whenever possible, make all MRs in response to an issue:
  * work on an MR in a feature branch with a name corresponding to the issue it resolves
    * eg: for issue number 99 with title "add lollipops" you'd make a branch called `99-add-lollipops`
  * prefix all commit messages with the number of the issue it is about
    * eg, on branch `99-add-lollipops`, all commit messages should start with `[99]`
  * reference the issue in the title of the MR
    * eg: `resolves "add lollipops" [#99]`
* **solicit feedback on thorny issues:** use issues to solicit input on potentially controversial or complex changes
  * if you want to make a potentially boat-rocking change, that's great! :)
  * please just give us a chance to talk about it first by opening an issue and marking it with the `Discussion` tag
  * this way, we can iron out any kinks and make sure that once you submit an MR, it meets the needs of the broader community and is more likely to be merged quickly! :)
* **non-issue-related MRs:** if it is very urgent or you are making a very small change that doesn't have an issue:
  * use a branch name that starts with `ns`, eg: `ns-add-lollipops`
  * prefix commit messages with `[ns]`, eg: `[ns] add lollipops`
  * mention `[nostory]` in the MR title, eg: `[nostory] add lollipops`
* **tests:** use tests! for everything you possibly can! :)
  * run the test suite (`yarn test`) before opening an MR. if tests are failing, we will not merge your code, and that would be sad! :(
  * write tests for any new code you write. if you add code with no tests, we will ask you to add tests before merging
* rebase onto master before merging
  * yes, we want you to rebase onto master instead of merging master into your branch.
  * this keeps the git history log graph nice and readable. (clean DAGs FTW! <3)
  * if one or more MRs have been merged between when you opened your MR and when it is merged, we might ask you to rebase agin
* **linting:** run the linter before opening your MR
  * we have a set of eslint rules so that we can settle boring/fiddly issues about formatting according to an objectively defined set of rules instead of getting into time-wasting not-fun subjective arguments about it
  * if your MR doesn't pass lint rules we will ask you to fix it before merging
  * to run the linter, use `yarn lint` from the project root
* **timely feedback:** you should expect to hear back from a `Team Friendo` member within 24 hours of submitting your request
  * if 48 hours passes and nobody has said anything, feel free to `@team-friendo` in the MR discussion to get our attention! :)


# Style Preferences <a name="style"></a>

We try to not to be too persnickety on Team Friendo (that's not inclusive!). That said, we do have a few "loosely held strong opinions" about how we like to write JavaScript. It will probably be easier to work together if we all try to use them as much as possible. If you don't like these rules or have better ones, that's cool! We'd love you to open an issue about that! :)

* prefer ES6 style to ES5 style
  * we think ES6 is generally more expressive and readable
  * here's a good overview of ES6 style JS features: https://ponyfoo.com/articles/es6
  * at a high-level, we suggest you try to use:
    * arrow functions
    * destructuring assignments
    * spread operators
    * async/await
    * const assignments (instead of var, or whenever possible, let)
* prefer a functional over an object-oriented style
  * avoid side-effects or mutable state where possible
  * prefer pure functions acting on data objects versus stateful classes with methods
  * use `lodash` to help you! https://lodash.com
* prefer small modules and functions to large ones
* prefer unit tests as documentation to long comments
* spend a lot of time thinking about good names
  * try to call things in the code what you would expect a user to call the in real life
  * try to consistently call things the same name everywhere in the code

# Talking to Humans <a name="comms"></a>

We realize that we probably haven't covered everything above exhaustively!

If you've got questions you'd like to talk to a human about, here are some good ways to get in touch with us:

* movement-hosted email: `team-friendo [at] riseup [dot] net`, gpg fingerprint: 2EEAFF8BD61D568E2A3168AAE726A156229F56F1
* corporate-hosted email: `team-friendo [at] protonmail [dot] com`
* signal message: `+1 (938) 444-8536`
* gitllab: open an issue and tag it with `Discussion` at https://0xacab.org/team-friendo/signalboost/-/boards
