var util = require('util');
var StatefulProcessCommandProxy = require('stateful-process-command-proxy');
var Mustache = require('mustache');
var fs = require('fs');

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
    constructor(success, ioEvent, message, error) {
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
}


class ShellExecReactorPlugin {

    /**
    * Constructor
    *
    * An io-event-reactor ReactorPlugin that reacts by invoking system commands via stateful-process-command-proxy: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    * @param reactorName - name of the IoReactor this Monitor plugin is bound to
    * @param logFunction - a function to be used for logging w/ signature function(severity, origin, message)
    * @param initializedCallback - when this ReactorPlugin is full initialized, this callback should be invoked
    *
    * @param pluginConfig - contains two objects:
    *
    *    - 'statefulProcessCommandProxy' - a stateful-process-command-proxy configuration object: https://github.com/bitsofinfo/stateful-process-command-proxy
    *
    *    - ONE of the following, but not both:
    *
    *       - 'commandTemplates' - an array of mustache (https://github.com/janl/mustache.js) template strings that will be executed
    *                              in order using stateful-process-command-proxy when this plugin's react() is invoked.
    *
    *                             Supported mustache template variables that will be made available to you:
    *                               - ioEventType: one of: 'add', 'addDir', 'unlink', 'unlinkDir', 'change'
    *                               - fullPath: string full path to file being reacted to
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
    constructor(reactorName,
                logFunction,
                errorCallback,
                initializedCallback,
                pluginConfig) {

        try {
            this._reactorName = reactorName;
            this._logFunction = logFunction;
            this._errorCallback = errorCallback;
            this._initializedCallback = initializedCallback;

            // process and build the StatefulProcessCommandProxy
            // that all commands will process
            try {
                // construct
                this._statefulProcessCommandProxy = new StatefulProcessCommandProxy(pluginConfig.statefulProcessCommandProxy);
            } catch(e) {
                var errMsg = this.__proto__.constructor.name +"["+this._reactorName+"] error constructing StatefulProcessCommandProxy: " + e;
                this._log('error',errMsg);
                this._onError(errMsg,e);
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
                                                                       'fullPath':'/test/full/path',
                                                                       'optionalFsStats':stats});

                                this._log('info',"commandTemplate["+template+"] rendered to: " + output);

                            } catch(e) {
                                var errMsg = this.__proto__.constructor.name +"["+this._reactorName+"] error pre-testing Mustache commandTemplate["+template+"]: " + e;
                                this._log('error',errMsg);
                            }
                        }
                    }).bind(this));
                } catch(e) {
                    var errMsg = this.__proto__.constructor.name +"["+this._reactorName+"] error pre-processing Mustache commandTemplates: " + e;
                    this._log('error',errMsg);
                    this._onError(errMsg,e);
                }
            }



        } catch(e) {
            var errMsg = this.__proto__.constructor.name +"["+this._reactorName+"] unexpected error: " + e;
            this._log('error',errMsg);
            this._onError(errMsg,e);
        }

    }

    /**
    * getName() - core ReactorPlugin function
    *
    * @return the short name used to bind this reactor plugin to an Evaluator
    */
    getName() {
        return 'logger';
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
            self._log('info',"REACT["+self.getName()+"]() invoked: " + ioEvent.getEventType() + " for: " + ioEvent.getFullPath);


              return Mustache.render(commandConfig.command,{'arguments':argumentsString});


            resolve(new ReactorResult(true,ioEvent,"no message"));


        });
    }

    /**
    *  Helper log function
    *  will set origin = this class' name
    */
    _log(severity,message) {
        this._logFunction(severity,(this.__proto__.constructor.name + '[' + this._reactorName + ']'),message);
    }

    /**
    *  Helper error function
    */
    _onError(errorMessage, error) {
        this._errorCallback(errorMessage, error);
    }

}

module.exports = ShellExecReactorPlugin;
