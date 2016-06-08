# io-event-reactor-plugin-shell-exec

Shell exec filesystem event reactor plugin for: [io-event-reactor](https://github.com/bitsofinfo/io-event-reactor) that
utilizes [stateful-process-command-proxy](https://github.com/bitsofinfo/stateful-process-command-proxy) for executing
system commands in any shell (bash, sh, powershell, ksh, whatever)

[![NPM](https://nodei.co/npm/io-event-reactor-plugin-shell-exec.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/io-event-reactor-plugin-shell-exec/)

## Usage

To configure this ReactorPlugin in your application that uses [io-event-reactor](https://github.com/bitsofinfo/io-event-reactor) do the following

```
npm install io-event-reactor-plugin-shell-exec
```

Then in your [io-event-reactor](https://github.com/bitsofinfo/io-event-reactor) configuration object that you pass to the `IoReactorService`
constructor, you can specify this plugin in the `reactors` block as so:

```
var ioReactorServiceConf = {

  ...

  ioReactors: [

          {
              id: "reactor1",

              monitor: {
                  ...
              },

              evaluators: [
                  {
                      evaluator: myEvaluatorFunction,
                      reactors: ['shellExec1,...'] // binds shell-exec to this evaluator
                  }
              ],

              reactors: [

                  // the "id" is what you use to bind this reactor
                  // to an evaluator above
                  { id: "shellExec1",

                    plugin: "io-event-reactor-plugin-shell-exec",

                    config: {

                        // Configuration for stateful-process-command-proxy
                        // for options see: https://github.com/bitsofinfo/stateful-process-command-proxy
                        statefulProcessCommandProxy: {
                            name: "whateverYouWant",
                            max: 2,
                            min: 1,
                            idleTimeoutMS: 120000,
                            logFunction: yourLoggerFunction,
                            processCommand: '/bin/bash',
                            processArgs:  ['-s'],
                            processRetainMaxCmdHistory : 10,
                            processCwd : './',
                            validateFunction: function(processProxy) {
                                return processProxy.isValid();
                            }
                        },

                        /**
                        * 'commandTemplates' - an array of mustache (https://github.com/janl/mustache.js) command template strings
                        *                   that will be executed in order using node-mysql when this plugin's react() is invoked.
                        *
                        *  Supported mustache template variables that will be made available to you: (a full IoEvent)
                        *    - see https://github.com/bitsofinfo/io-event-reactor-plugin-support for IoEvent definition
                        *    - ioEvent.uuid
                        *    - ioEvent.eventType: one of: 'add', 'addDir', 'unlink', 'unlinkDir', 'change'
                        *    - ioEvent.fullPath: string full path to file being reacted to (filename/dir inclusive)
                        *    - ioEvent.parentPath: full path to the directory containing the item manipulated
                        *    - ioEvent.filename: filename/dirname only (no path information)
                        *    - ioEvent.optionalFsStats: optional stats object -> https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_stats
                        *    - ioEvent.optionalExtraInfo: optional object, see the MonitorPlugin you are using to see the spec and when/if its available
                        */
                        commandTemplates: [
                            'cp {{{ioEvent.fullpath}}} /some/other/dir'
                        ],

                        /**
                        * 'commandGenerator' - callback function(ioEvent) that must return an array[] of command statements
                        *                     literals that will be executed in order using
                        *                     stateful-process-command-proxy when this plugin's react() is invoked.
                        */
                        commandGenerator: function(ioEvent) {
                          return [('cp '+ioEvent.fullpath+' /some/other/dir')];
                        }
                     }
                  },

                  ....
              ]
        },
        ....
    ]

    ...
};
```

### Unit tests

To run the unit tests go to the root of the project and run the following.

```
mocha test/all.js
```
