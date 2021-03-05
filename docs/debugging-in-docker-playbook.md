# Debugging in docker playbook

Motivation: Our IDEs tend to have really nice debuggers that tend to not work when we are running the app(s) inside of docker containers. This playbook helps you set up a "remote debugger" in your IDE that will attach to app(s) running inside a docker container. 

## Docker Configurations

- use the `port` directive to:
  - expose port 8016 on the containers to which you want to attach a debugge
  - forward some known port on `localhost` to that port
- for an example, see: https://0xacab.org/team-friendo/signalboost/-/merge_requests/470/diffs

## IDE configuration 

### Jetbrains (Intellij/Webstorm)

- select the `Run / Edit Configurations` menu
- click the + sign to create a new debuger
- select the option for creating a new debubber configuration:
  - in IntelliJ, this will be called Remote Debugger
  - in WebStorm, this will be called Attach to Node.js/Chrome
- give the debugger a name 
- set the host to `localhost`
- fill in the box for port with the port on localhost that is forwarding to port 8016 on the container you want to debug
  - for signalboost, this is port 9229
  - for signalc, this is port 8016  
  - for signald, you need N debugger configurations, which differ only in the port that they set, ranging from 8010 (for the
    debugger for the signald-0 container) up to 801N (for the debugger for the signald-N container)

### VSCode

- Node: https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_remote-debugging
- JVM: https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug