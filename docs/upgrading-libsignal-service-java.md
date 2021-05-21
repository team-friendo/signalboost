# Updating our fork of libsignal-service-java

We maintain a fork of libsignal-service-java here:
https://0xacab.org/team-friendo/libsignal-service-java-murmur

It in turn tracks turasa/asamk's unofficial fork of libsignalservice-java here:
https://github.com/Turasa/libsignal-service-java

We periodically want to update our libsignal fork to pull in changes from upstream and rebuild signalc against it.

Here is how to do that:

# Testing

Publish and use a test version of the update:

- (1) pull in upstream changes
  - create a feature branch on our fork repo
  - merge from turasa's upstream "master" [sic] branch (NOTE: it is important to merge and NOT rebase!)
  - open a merge request with these changes, pointing to the commit in turasa's branch that we intend to sync with
    - bonus points: also link to MR/issue in signalboost that will use this bump (if applicable)
- (2) bump the version number in `libsignal`:
  - in `build.gradle` in the `libsignal-service-java-murmur` project's root directory, change the `ext.lib_signal_service_version_number` by bumping it to the next version, with a `WIP` tag appended
  - we have versions for upstream changes and version for murmur-generated changes
    - upstream are denoted with a `t`: `t19`
    - murmur-generated are previxed with a `m`
  - when you make an MR, try to compartmentalize it to contain only upstream or murmur-generated changes, and increment the appropriate version accordingly. for example, assuming the old version was `2.15.3_unofficial_t10_m1`:
    - if merging upstream (turasa-made) changes, bump to: `2.15.3_unofficial_t11_m1`
    - if merging murmur-made changes, bump to: `2.15.3_unofficial_t10_m2`
    - if merging both turasa-made and murmur-made changes (try to avoid this!), bump to: `2.15.3_unofficial_t11_m2`
- (3) publish a jar to our repo
  - unlock 0xacab api token: from `libsignal` root, run `make blackbox.decrypt` (now we have the token we need to pub to 0xacab)
  - run `make publish.remoteMaven` to publish the jar
  - optionally: check repo to see if publication worked: https://0xacab.org/team-friendo/signalboost/-/packages
- (4) use the jar in signalc
  - update build: in `signalc/build.gradle.kts` bump the version number of `Versions.libsignal` to match the version created above
  - rebuild signalc: `make sc.build`
  - run (`make sc.up`), and fix any compile or runtime errors produced by bumping underlying libsignal dependency

# Committing

Once satisfied that the jar works, publish a non-WIP version:

- (1) modify the version number in libsignal:
  - in `libsignalsservice-java-fork/build.gradle`, remove the trailing `_WIP` from the `ext.lib_signal_service_version_number`
  - merge the MR in our libsignal fork repo
- (2) republish the libsignal jar:
  - from `libsignalservice-java-fork` project root, run `make publish.remoteMaven` again
- (3) use the final jar in singalc
  - modify `signalc/build.gradle`'s value for `Versions.libsignal` to strip the `_WIP_`
  - smoke test as desired
  - commit changes to signalboost repo!
