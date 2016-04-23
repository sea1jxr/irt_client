/*
 * Copyright (c) 2016 Inside Ride Technologies, LLC. All Rights Reserved.
 * Author: Jason De Lorme (jason@insideride.com)
 *
 * Module that decodes messages and issues commands for the ANT+ Bike Power protocol. 
 */

// Set this up as an event emitter.
const util = require('util');
const EventEmitter = require('events').EventEmitter;

const AntBikePower = function() { 
    var self = this;
        
    const antlib = require('./antlib.js');
    
    var bpChannelId = 0;
    const bpChannelEventBuffer = new Buffer(antlib.MESG_MAX_SIZE_VALUE);
    //const transmitBuffer = new Buffer(antlib.ANT_STANDARD_DATA_PAYLOAD_SIZE);

    const STANDARD_POWER_ONLY_PAGE = 0x10;

    // Keep a running accumuation.
    var accumulatedPower = 0;
    var eventCount = 0;

    // Accumulates power beyond the 16 bits.
    function getAccumulatedPower(power) {
        // Did a rollover occur?
        if (power < (accumulatedPower & 0xFFFF)) {
            // Bitshift accumulator over 1.
            accumulatedPower = accumulatedPower << 1;
        }
        
        accumulatedPower = (accumulatedPower & 0xFFFF0000) | power; 

        return accumulatedPower;
    }

    // Accumulates event count beyond the 8 bits.
    function getEventCount(events) {
        // Did a rollover occur?
        if (events < (eventCount & 0xFF)) {
            // Bitshift accumulator over 1.
            eventCount = eventCount << 1;
        }
        
        eventCount = (eventCount & 0xFFFFFF00) | events; 
        
        return eventCount;
    }


    // Parse ANT+ message for power.
    function parseStandardPowerOnly() {
        var page = { 
            eventCount : getEventCount(bpChannelEventBuffer[2]),
            // pedalPower : future implement
            instantCadence : bpChannelEventBuffer[4],
            accumulatedPower : getAccumulatedPower(bpChannelEventBuffer[6] << 8 |
                bpChannelEventBuffer[5]),
            instantPower : bpChannelEventBuffer[8] << 8 | bpChannelEventBuffer[7]   
        };
        
        return page;
    }

    // Function called back by the ant library when a message arrives.
    function bpChannelEvent(channelId, eventId) { 
        if (channelId != bpChannelId) {
            console.log('Wrong channel.');
            return;
        }
        
        var messagedId = bpChannelEventBuffer[1];
        switch (messagedId) {
            case STANDARD_POWER_ONLY_PAGE:
                self.emit('message', 'standardPowerOnly', parseStandardPowerOnly());
                break;
            case antlib.PRODUCT_PAGE:
                self.emit('message', 'productInfo', 
                    antlib.parseProductInfo(bpChannelEventBuffer));
                break;
            case antlib.MANUFACTURER_PAGE:
                self.emit('message', 'manufacturerInfo', 
                    antlib.parseManufacturerInfo(bpChannelEventBuffer));
                break;                
            default:
                console.log('Unrecognized message.', messagedId);
                break;
        }
    }

    // Configure the channel.
    const BP_CHANNEL_CONFIG = { 
        channelType: 0, 
        deviceId: 0, 
        deviceType: 0x0B, 
        transmissionType: 0, 
        frequency: 57, 
        channelPeriod: 8182, 
        channelCallback: bpChannelEvent 
    };
    
    // Opens the FE-C channel.
    function openChannel(deviceId) {
        // Start.    
        antlib.init();
        
        if (deviceId != null) {
            BP_CHANNEL_CONFIG.deviceId = deviceId;
        }
        bpChannelId = antlib.openChannel(BP_CHANNEL_CONFIG, bpChannelEventBuffer);     
    }

    AntBikePower.prototype.openChannel = openChannel;
};

util.inherits(AntBikePower, EventEmitter);
module.exports = AntBikePower;