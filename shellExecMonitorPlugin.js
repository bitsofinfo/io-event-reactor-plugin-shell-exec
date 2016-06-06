var util = require('util');
var StatefulProcessCommandProxy = require('stateful-process-command-proxy');
var Mustache = require('mustache');
var fs = require('fs');
var path = require('path');
var PromiseLib = require('promise');

/**
* IoEvent class, encapsulates all information
* that makes up an IoEvent triggered by a MonitorPlugin
*
* ReactorPlugin's react() method will be passed objects of
* this specification
*
*/
class IoEvent {
    constructor(ioEventType, fullPath, optionalFsStats, optionalExtraInfo) {
        this._eventType = ioEventType;
        this._fullPath = fullPath;
        this._optionalFsStats = optionalFsStats;
        this._optionalExtraInfo = optionalExtraInfo;
    }
    get eventType() {
        return this._eventType;
    }
    get fullPath() {
        return this._fullPath;
    }
    get optionalFsStats() {
        return this._optionalFsStats;
    }
    get optionalExtraInfo() {
        return this._optionalExtraInfo;
    }
}


/**
* ReactorResult class, represents a result from the
* invocation of a ReactorPlugin's react() method
*
* ReactorPlugins must fulfill/reject with an object
* that meets this specification
*
*/
class ReactorResult {
    constructor(success, pluginId, reactorId, ioEvent, message, error) {
        this._pluginId = pluginId;
        this._reactorId = reactorId,
        this._ioEvent = ioEvent;
        this._success = success;
        this._message = message;
        this._error = error;
    }
    get isSuccess() {
        return this._success;
    }
    get message() {
        return this._message;
    }
    get ioEvent() {
        return this._ioEvent;
    }
    get error() {
        return this._error;
    }
    get pluginId() {
        return this._pluginId;
    }
    get reactorId() {
        return this._reactorId;
    }
}


class ShellExecReactorPlugin {

    /**
    * Constructor
    *
    * An io-event-reactor ReactorPlugin that reacts by invoking system commands via stateful-process-command-proxy: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    * @param pluginId - identifier for this plugin
    * @param reactorId - id of the IoReactor this Monitor plugin is bound to
    * @param logFunction - a function to be used for logging w/ signature function(severity, origin, message)
    * @param initializedCallback - when this ReactorPlugin is full initialized, this callback should be invoked
    *
    * @param pluginConfig - contains two objects:
    *
    *    - 'statefulProcessCommandProxy' - a stateful-process-command-proxy configuration object: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    *    - one of both of the following
    *
    *       - 'commandTemplates' - an array of mustache (https://github.com/janl/mustache.js) template strings that will be executed
    *                              in order using stateful-process-command-proxy when this plugin's react() is invoked.
    *
    *                             Supported mustache template variables that will be made available to you:
    *                               - ioEventType: one of: 'add', 'addDir', 'unlink', 'unlinkDir', 'change'
    *                               - fullPath: string full path to file being reacted to (filename/dir inclusive)
    *                               - parentPath: full path to the directory containing the item manipulated
    *                               - filename: filename/dirname only (no path information)
    *                               - optionalFsStats: optional stats object -> https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_stats
    *                               - optionalExtraInfo: optional object, see the MonitorPlugin you are using to see the spec and when/if its available
    *
    *       - 'commandGenerator' - callback function(ioEventType, fullPath, optionalFsStats, optionalExtraInfo) that must
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

            // process and build the StatefulProcessCommandProxy
            // that all commands will process
            try {
                // construct
                this._statefulProcessCommandProxy = new StatefulProcessCommandProxy(pluginConfig.statefulProcessCommandProxy);
            } catch(e) {
                var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error constructing StatefulProcessCommandProxy: " + e;
                this._log('error',errMsg);
                this._onError(errMsg,e);
            }

            // Handle 'commandGenerator'
            if (typeof(pluginConfig.commandGenerator) != 'undefined') {
                this._commandGenerator = pluginConfig.commandGenerator;

                // test/validate it
                try {
                    // validate all templates (we will use the stat object from this file itself)
                    fs.stat(__filename, (function(err,stats) {

                        if (err) {
                            throw err;
                        }

                        var output = this._commandGenerator('add','/test/full/path/tothing',stats);
                        this._log('info',"commandGenerator() function returned test command to exec: " + output);

                    }).bind(this));
                } catch(e) {
                    var errMsg = this.__proto__.constructor.name +"["+this._reactorId+"]["+this.getId()+"] error pre-processing commandGenerator: " + e;
                    this._log('error',errMsg);
                    this._onError(errMsg,e);
                }
            }


            // Handle 'commandTemplates', pre-test them all
            if (typeof(pluginConfig.commandTemplates) != 'undefined') {
                try {
                    this._commandTemplates = pluginConfig.commandTemplates;

                    // validate all templates (we will use the stat object from this file itself)
                    fs.stat(__filename, (function(err,stats) {

                        if (err) {
                            throw err;
                        }

                        for (let template of this._commandTemplates) {
                            try {
                                var output = Mustache.render(template,{'ioEventType':'testEventType',
                                                                       'fullPath':'/test/full/path/tothing',
                                                                       'parentPath':'/test/full/path',
                                                                       'filename':'tothing',
                                                                       'optionalFsStats':stats});

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

            var parentPath = path.dirname(ioEvent.fullPath) ;
            var filename = path.basename(ioEvent.fullPath);
            var commandsToExec = [];

            /**
            * #1 Collect commands to exec from Command templates....
            */
            if (self._commandTemplates && self._commandTemplates.length > 0) {

                // for each template, render it and push on to list of commands to exec
                for (let template of self._commandTemplates) {
                    try {
                        var commandToExec = Mustache.render(template,{'ioEventType':ioEvent.eventType,
                                                                      'fullPath':ioEvent.fullPath,
                                                                      'parentPath':parentPath,
                                                                      'filename':filename,
                                                                      'optionalFsStats':ioEvent.optionalFsStats,
                                                                      'optionalExtraInfo':ioEvent.optionalExtraInfo});
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
            if (self._commandGenerator && typeof(_commandGenerator) == 'function') {

                try {
                    // generate
                    var generatedCmds = self._commandGenerator(ioEvent.eventType, ioEvent.fullPath)

                    // concatenate them
                    if (generatedCmds && generatedCmds.length > 0) {
                        commandsToExec.concat(generatedCmds);
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
                        console.log("CmdResult: command:" + result.command + " stdout:" + result.stdout + " stderr:" + result.stderr);
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
