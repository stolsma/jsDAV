/*
 * @package jsDAV
 * @subpackage DAV
 * @copyright Copyright(c) 2011 Ajax.org B.V. <info AT ajax DOT org>
 * @author Mike de Boer <info AT mikedeboer DOT nl>
 * @license http://github.com/mikedeboer/jsDAV/blob/master/LICENSE MIT License
 */
"use strict";

var jsDAV_FS_Node = require("./../fs/node").jsDAV_FS_Node;
var jsDAV_iProperties = require("./../iProperties").jsDAV_iProperties;

var Fs   = require("fs");
var Path = require("path");
var Util = require("./../util");

function jsDAV_FSExt_Node(path) {
    this.path = path;
}

exports.jsDAV_FSExt_Node = jsDAV_FSExt_Node;

(function() {
    this.implement(jsDAV_iProperties);

    /**
     * Updates properties on this node,
     *
     * @param {array} properties
     * @see jsDAV_iProperties#updateProperties
     * @return bool|array
     */
    this.updateProperties = function(properties, cbupdateprops) {
        var self = this;
        this.getResourceData(function(err, resourceData) {
            if (err)
                return cbupdateprops(err, false);

            var propertyName, propertyValue;
            for (propertyName in properties) {
                if (!properties.hasOwnProperty(propertyName))
                    continue;
                propertyValue = properties[propertyName];
                // If it was null, we need to delete the property
                if (Util.empty(propertyValue)) {
                    if (typeof resourceData["properties"][propertyName] != "undefined")
                        delete resourceData["properties"][propertyName];
                }
                else {
                    resourceData["properties"][propertyName] = propertyValue;
                }
            }
    
            self.putResourceData(resourceData, cbupdateprops);
        });
    };

    /**
     * Returns a list of properties for this nodes.;
     *
     * The properties list is a list of propertynames the client requested, encoded as xmlnamespace#tagName, for example: http://www.example.org/namespace#author
     * If the array is empty, all properties should be returned
     *
     * @param array properties
     * @return array
     */
    this.getProperties = function(properties, cbgetprops) {
        this.getResourceData(function(err, resourceData) {
            if (err)
                return cbgetprops(err);

            // if the array was empty, we need to return everything
            if (!properties || !properties.length)
                return resourceData["properties"];
    
            var props = {};
            properties.forEach(function(property) {
                if (typeof resourceData["properties"][property] != "undefined")
                    props[property] = resourceData["properties"][property];
            });
    
            cbgetprops(null, props);
        });
    };

    /**
     * Returns the path to the resource file
     *
     * @return string
     */
    this.getResourceInfoPath = function() {
        return Util.splitPath(this.path)[0] + "/.jsdav";
    };

    /**
     * Returns all the stored resource information
     *
     * @return array
     */
    this.getResourceData = function(cbgetdata) {
        var path = this.getResourceInfoPath();
        var name = this.getName();
        var empty = {
            "properties": {}
        };

        Path.exists(path, function(exists) {
            if (!exists)
                return cbgetdata(null, empty);

            // opening up the file, and read its contents
            Fs.readFile(path, "utf8", function(err, data) {
                if (err)
                    return cbgetdata(err);

                // Unserializing and checking if the resource file contains data for this file
                try {
                    data = JSON.parse(data);
                }
                catch(ex) {
                    return cbgetdata(null, empty);
                }
                
                if (!data[name])
                    return cbgetdata(null, empty);

                data = data[name];
                if (!data["properties"])
                    data["properties"] = {};
                cbgetdata(null, data);
            });
        });
    };

    /**
     * Updates the resource information
     *
     * @param array newData
     * @return void
     */
    this.putResourceData = function(newData, cbputdata) {
        var path = this.getResourceInfoPath();
        var name = this.getName();
        
        Path.exists(path, function(exists) {
            var data = {};
            if (exists) {
                // opening up the file, and read its contents
                Fs.readFile(path, "utf8", function(err, fdata) {
                    if (err)
                        return cbputdata(err, false);
        
                    // Unserializing and checking if the resource file contains data for this file
                    try {
                        data = JSON.parse(fdata);
                    }
                    catch(ex) {
                        data = {};
                    }
                    writeOut();
                });
            }
            else {
                writeOut();
            }
            
            function writeOut() {
                data[name] = newData;
                Fs.writeFile(path, JSON.stringify(data), "utf8", function(err) {
                    cbputdata(err, !!err);
                });
            }
        });
    };

    /**
     * Renames the node
     *
     * @param string name The new name
     * @return void
     */
    this.setName = function(name, cbsetname) {
        var parentPath = Util.splitPath(this.path)[0];
        var newName = Util.splitPath(name)[1];
        var newPath = parentPath + "/" + newName;

        // We're deleting the existing resourcedata, and recreating it
        // for the new path.
        var self = this;
        this.getResourceData(function(err, resourceData) {
            if (err)
                return cbsetname(err);

            self.deleteResourceData(function(err) {
                if (err)
                    return cbsetname(err);
        
                Fs.rename(self.path, newPath, function(err) {
                    if (err)
                        return cbsetname(err);

                    self.path = newPath;
                    self.putResourceData(resourceData, cbsetname);
                });
            });
        });
    };

    /**
     * @return bool
     */
    this.deleteResourceData = function(cbdeldata) {
        // When we're deleting this node, we also need to delete any resource information
        var path = this.getResourceInfoPath();
        var name = this.getName();

        Path.exists(path, function(exists) {
            if (!exists)
                return cbdeldata();

            // opening up the file, and read its contents
            Fs.readFile(path, "utf8", function(err, data) {
                if (err)
                    return cbdeldata(err);

                // Unserializing and checking if the resource file contains data for this file
                try {
                    data = JSON.parse(data);
                }
                catch(ex) {
                    return cbdeldata();
                }
                
                if (!data[name])
                    return cbdeldata();

                delete data[name];
                Fs.writeFile(path, JSON.stringify(data), "utf8", cbdeldata);
            });
        });
    };

    // @todo our inheritence-chain doesn't provide super-child method invocation...
    this.$delete = function(cbdel) {
        this.deleteResourceData(cbdel);
    };
}).call(jsDAV_FSExt_Node.prototype = new jsDAV_FS_Node());
