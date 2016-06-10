'use strict'

var IoEvent = require('io-event-reactor-plugin-support').IoEvent;
var ReactorResult = require('io-event-reactor-plugin-support').ReactorResult;

var util = require('util');
var StatefulProcessCommandProxy = require('stateful-process-command-proxy');
var Mustache = require('mustache');
var fs = require('fs');
var path = require('path');

class ShellExecReactorPlugin {

    /**
    * Constructor
    *
    * An io-event-reactor ReactorPlugin that reacts by invoking system commands via stateful-process-command-proxy: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    * @param pluginId - identifier for this plugin
    * @param reactorId - id of the IoReactor this Monitor plugin is bound to
    * @param logFunction - a function to be used for logging w/ signature function(severity, origin, message)
    * @param initializedCallback - when this ReactorPlugin is full initialized, this callback  function(reactorPluginId) should be invoked
    *
    * @param pluginConfig - contains two objects:
    *
    *    - 'statefulProcessCommandProxy' - contains ONE of two possible properties
    *
    *            - 'config' -  stateful-process-command-proxy configuration object: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    *             OR
    *
    *            - 'instance' - a pre-existing StatefulProcessCommandProxy instance to re-use
    *
    *
    *    - AND one or both of the following
    *
    *       - 'commandTemplates' - an array of mustache (https://github.com/janl/mustache.js) template strings that will be executed
    *                              in order using stateful-process-command-proxy when this plugin's react() is invoked.
    *
    *                             Supported mustache template variables that will be made available to you: (a full IoEvent)
    *                               - see https://github.com/bitsofinfo/io-event-reactor-plugin-support for IoEvent definition
    *                               - ioEvent.uuid
    *                               - ioEvent.eventType: one of: 'add', 'addDir', 'unlink', 'unlinkDir', 'change'
    *                               - ioEvent.fullPath: string full path to file being reacted to (filename/dir inclusive)
    *                               - ioEvent.parentPath: full path to the directory containing the item manipulated
    *                               - ioEvent.parentName: parent directory name only
    *                               - ioEvent.filename: filename/dirname only (no path information)
    *                               - ioEvent.optionalFsStats: optional stats object -> https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_stats
    *                               - ioEvent.optionalExtraInfo: optional object, see the MonitorPlugin you are using to see the spec and when/if its available
    *
    *       - 'commandGenerator' - callback function(ioEvent) that must
    *                              return an array[] of command string literals that will be executed in order using
    *                              stateful-process-command-proxy when this plugin's react() is invoked.
    *
    *
    *
    */
    constructor(pluginId,
                reactorId,
                logFunction,
                errorCallback,
                initializedCallback,
                pluginConfig) {

        try {
            this._pluginId = pluginId;
            this._reactorId = reactorId;
            this._logFunction = logFunction;
            this._errorCallback = errorCallback;
            this._initializedCallback = initializedCallback;

            // is statefulProcessCommandProxy.config present? construct a new one
            if (typeof(pluginConfig.statefulProcessCommandProxy.config) != 'undefined' &&
                pluginConfig.statefulProcessCommandProxy.config != null) {

                // process and build the StatefulProcessCommandProxy
                // that all commands will process
                try {
                    // construct
                    this._statefulProcessCommandProxy = new StatefulProcessCommandProxy(pluginConfig.statefulProcessCommandProxy.config);
                } catch(e) {
                    var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error constructing StatefulProcessCommandProxy: " + e;
                    this._log('error',errMsg);
                    this._onError(errMsg,e);
                }

            // is statefulProcessCommandProxy.instance present? just set our instance to it
            } else if (typeof(pluginConfig.statefulProcessCommandProxy.instance) != 'undefined' &&
                          pluginConfig.statefulProcessCommandProxy.instance != null) {

                this._statefulProcessCommandProxy = pluginConfig.statefulProcessCommandProxy.instance;

            } else {
                throw new Error("pluginConfig.statefulProcessCommandProxy must contain either 'instance' or 'config'");
            }


            // Handle 'commandGenerator'
            if (typeof(pluginConfig.commandGenerator) == 'function') {
                this._commandGenerator = pluginConfig.commandGenerator;

                // test/validate it
                try {
                    // validate all templates (we will use the stat object from this file itself)
                    fs.stat(__filename, (function(err,stats) {

                        if (err) {
                            throw err;
                        }

                        var ioEvent = new IoEvent('testEventType','/test/full/path/tothing.zip', stats);

                        var output = this._commandGenerator(ioEvent);
                        this._log('info',"commandGenerator() function returned test command to exec: " + output);

                    }).bind(this));
                } catch(e) {
                    var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error pre-processing commandGenerator: " + e;
                    this._log('error',errMsg);
                    this._onError(errMsg,e);
                }
            }


            // Handle 'commandTemplates', pre-test them all
            if (typeof(pluginConfig.commandTemplates) != 'undefined' && pluginConfig.commandTemplates != null) {
                try {
                    this._commandTemplates = pluginConfig.commandTemplates;

                    // validate all templates (we will use the stat object from this file itself)
                    fs.stat(__filename, (function(err,stats) {

                        if (err) {
                            throw err;
                        }

                        var ioEvent = new IoEvent('testEventType','/test/full/path/tothing', stats);

                        for (let template of this._commandTemplates) {
                            try {
                                var output = Mustache.render(template,{'ioEvent':ioEvent});

                                this._log('info',"commandTemplate["+template+"] rendered to: " + output);

                            } catch(e) {
                                var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error pre-testing Mustache commandTemplate["+template+"]: " + e;
                                this._log('error',errMsg);
                            }
                        }
                    }).bind(this));
                } catch(e) {
                    var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error pre-processing Mustache commandTemplates: " + e;
                    this._log('error',errMsg);
                    this._onError(errMsg,e);
                }

                // invoked initialized function callback
                this._initializedCallback(this.getId());
            }


        } catch(e) {
            var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] unexpected error: " + e;
            this._log('error',errMsg);
            this._onError(errMsg,e);
        }

    }

    /**
    * getId() - core ReactorPlugin function
    *
    * @return the short name used to bind this reactor plugin to an Evaluator
    */
    getId() {
        return this._pluginId;
    }

    /**
    * react() - core ReactorPlugin function
    *
    * This function is required on ReactorPlugin implementations
    *
    * @param ioEvent - IoEvent object to react to
    * @return Promise - when fulfilled/rejected a ReactorResult object, on error the ReactorResult will contain the error
    *
    */
    react(ioEvent) {
        var self = this;

        return new Promise(function(resolve, reject) {

            self._log('info',"REACT["+self.getId()+"]() invoked: " + ioEvent.eventType + " for: " + ioEvent.fullPath);

            var commandsToExec = [];

            /**
            * #1 Collect commands to exec from Command templates....
            */
            if (self._commandTemplates && self._commandTemplates.length > 0) {

                // for each template, render it and push on to list of commands to exec
                for (let template of self._commandTemplates) {
                    try {
                        var commandToExec = Mustache.render(template,{'ioEvent':ioEvent});
                        if (commandToExec) {
                            commandsToExec.push(commandToExec);
                        }
                    } catch(e) {
                        reject(new ReactorResult(false,self.getId(),self._reactorId,ioEvent,"Error generating command from mustache template: " + template + " " +  e, e));
                    }
                }
            }

            /**
            * #2 Collection commands to exec from Command generator function
            */
            if (self._commandGenerator && typeof(self._commandGenerator) == 'function') {

                try {
                    // generate
                    var generatedCmds = self._commandGenerator(ioEvent);

                    // concatenate them
                    if (generatedCmds && generatedCmds.length > 0) {
                        commandsToExec = commandsToExec.concat(generatedCmds);
                    }

                } catch(e) {
                    reject(new ReactorResult(false,self.getId(),self._reactorId,ioEvent,"Error generating command from command generator function: " + e, e));
                }
            }

            /**
            * #3 Exec all commands!
            */
            self._statefulProcessCommandProxy.executeCommands(commandsToExec)
                .then(function(cmdResultsArray) {

                    for (let result of cmdResultsArray) {
                        self._log('info',"CmdResult: cmd: " + result.command + " stdout:" + result.stdout + " stderr:" + result.stderr);
                    }
                    resolve(new ReactorResult(true,self.getId(),self._reactorId,ioEvent,"Executed commands successfully"));

                }).catch(function(error) {
                    reject(new ReactorResult(false,self.getId(),self._reactorId,ioEvent,"Error executing commands: " + error, error));
                });

        });
    }

    /**
    *  Helper log function
    *  will set origin = this class' name
    */
    _log(severity,message) {
        this._logFunction(severity,(this.__proto__.constructor.name + '[' + this._reactorId + ']['+this.getId()+']'),message);
    }

    /**
    *  Helper error function
    */
    _onError(errorMessage, error) {
        this._errorCallback(errorMessage, error);
    }

}

module.exports = ShellExecReactorPlugin;
