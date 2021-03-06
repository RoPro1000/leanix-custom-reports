var ReportApplicationPortfolio = (function () {
    function ReportApplicationPortfolio(reportSetup, tagFilter, title) {
        this.reportSetup = reportSetup;
        this.tagFilter = tagFilter;
        this.title = title;
    }

    ReportApplicationPortfolio.prototype.render = function () {
        var that = this;

        var tagGroupPromise = $.get(this.reportSetup.apiBaseUrl + '/tagGroups')
            .then(function (response) {
                var tagGroups = {};
                for (var i = 0; i < response.length; i++) {
                    tagGroups[response[i]['name']] = [];
                    for (var j = 0; j < response[i]['tags'].length; j++) {
                        tagGroups[response[i]['name']].push(response[i]['tags'][j]['name']);
                    }
                }
                return tagGroups;
            });

        var userPromise = $.get(this.reportSetup.apiBaseUrl + '/users')
            .then(function (response) {
                var users = {};
                for (var i = 0; i < response.length; i++) {
                    users[response[i]['ID']] = response[i]['email'];
                }
                return users;
            });


        var factSheetPromise = $.get(this.reportSetup.apiBaseUrl +
            '/factsheets?relations=true&types[]=10&types[]=18&types[]=19' +
            '&filterRelations[]=serviceHasBusinessCapabilities' +
            '&filterRelations[]=factSheetHasLifecycles' +
            '&filterRelations[]=serviceHasResources' +
            '&filterRelations[]=userSubscriptions' +
            '&filterAttributes[]=businessCriticalityID' +
            '&filterAttributes[]=alias' +
            '&filterAttributes[]=description' +
            '&filterAttributes[]=displayName' +
            '&filterAttributes[]=fullName' +
            '&filterAttributes[]=functionalSuitabilityID' +
            '&filterAttributes[]=ID' +
            '&filterAttributes[]=resourceType' +
            '&filterAttributes[]=objectCategoryID' +
            '&filterAttributes[]=tags' +
            '&filterAttributes[]=technicalSuitabilityID' +
            '&pageSize=-1')
            .then(function (response) {
                return response.data;
            });

        $.when(tagGroupPromise, userPromise, factSheetPromise)
            .then(function (tagGroups, users, data) {

                var fsIndex = new FactSheetIndex(data);
                var list = fsIndex.getSortedList('services');
                var reportUtils = new ReportUtils();

                var getTagFromGroup = function (object, validTags) {
                    var cc = object.tags.filter(function (x) {
                        if (validTags.indexOf(x) >= 0)
                            return true;
                        else
                            return false;
                    });

                    if (cc.length)
                        return cc[0];

                    return '';
                };

                var getLookup = function (data) {
                    var ret = {};
                    for (var i = 0; i < data.length; i++) {
                        ret[data[i]] = data[i];
                    }

                    return ret;
                };

                var output = [];
                var markets = {};
                var projectEffects = {};
                var projectTypes = {};

                var costCentres = tagGroups['Cost Centre'];
                var appTypes = tagGroups['Application Type'];
                var customisations = tagGroups['Customisation Level'];
                var complexities = tagGroups['Application Complexity'];
                var pciFlags = tagGroups['PCI Flag'];
                var soxFlags = tagGroups['SOX Flag'];
                var recommendations = tagGroups['Recommendation'];
                var lastUpgrades = tagGroups['Last Major Upgrade'];

                var businessValue = {
                    4: "4-High",
                    3: "3-Med/High",
                    2: "2-Low/Med",
                    1: "1-Low"
                };
                var businessValueOptions = [];
                for (var key in businessValue) {
                    businessValueOptions.push(businessValue[key]);
                }

                var technicalCondition = {
                    4: "4-High",
                    3: "3-Med/High",
                    2: "2-Low/Med",
                    1: "1-Low"
                };
                var technicalConditionOptions = [];
                for (var key in technicalCondition) {
                    technicalConditionOptions.push(technicalCondition[key]);
                }

                var businessCriticality = {
                    1: "Mission Critical",
                    2: "Business Premium",
                    3: "Business Standard",
                    4: "Basic"
                };
                var businessCriticalityOptions = [];
                for (var key in businessCriticality) {
                    businessCriticalityOptions.push(businessCriticality[key]);
                }
                var lifecycleArray = reportUtils.lifecycleArray();


                for (var i = 0; i < list.length; i++) {
                    if (!that.tagFilter || list[i].tags.indexOf(that.tagFilter) != -1) {

                        // Extract market
                        var re = /^([A-Z]{2,3})_/;
                        var market = '';

                        if ((m = re.exec(list[i].fullName)) !== null) {
                            if (m.index === re.lastIndex) {
                                re.lastIndex++;
                            }
                            // View your result using the m-variable.
                            market = m[1];
                            if (market)
                                markets[market] = market;
                        }

                        var resources = [];
                        var remedy = [];
                        var support = [];
                        for (var z = 0; z < list[i].serviceHasResources.length; z++) {
                            var tmp = list[i].serviceHasResources[z];
                            if (tmp) {
                                if (tmp.resourceID && fsIndex.index.resources[tmp.resourceID]) {

                                    if (fsIndex.index.resources[tmp.resourceID].tags.indexOf('Remedy Business Service') != -1) {
                                        remedy.push({
                                            id: tmp.resourceID,
                                            name: fsIndex.index.resources[tmp.resourceID].fullName,
                                        });
                                    } else if (fsIndex.index.resources[tmp.resourceID].objectCategoryID == 3) {
                                        support.push({
                                            id: tmp.resourceID,
                                            name: fsIndex.index.resources[tmp.resourceID].fullName,
                                        });
                                    } else {
                                        resources.push({
                                            id: tmp.resourceID,
                                            name: fsIndex.index.resources[tmp.resourceID].fullName,
                                        });
                                    }
                                }
                            }
                        }

                        var cobras = [];
                        for (var z = 0; z < list[i].serviceHasBusinessCapabilities.length; z++) {
                            var tmp = list[i].serviceHasBusinessCapabilities[z];
                            if (tmp) {
                                if (tmp.businessCapabilityID && fsIndex.index.businessCapabilities[tmp.businessCapabilityID] &&
                                    fsIndex.index.businessCapabilities[tmp.businessCapabilityID].tags.indexOf('AppMap') != -1) {

                                    cobras.push({
                                        id: tmp.businessCapabilityID,
                                        name: fsIndex.index.businessCapabilities[tmp.businessCapabilityID].fullName,
                                    })
                                }
                            }
                        }
                        var currentLifecycle = reportUtils.getCurrentLifecycle(list[i]);
                        var golive = reportUtils.getLifecycle(list[i], 3);
                        var retired = reportUtils.getLifecycle(list[i], 5);

                        var itOwner = '';
                        var businessOwner = '';
                        var spoc = '';
                        for (var j = 0; j < list[i].userSubscriptions.length; j++) {
                            var subscription = list[i].userSubscriptions[j];
                            for (var k = 0; k < subscription.roleDetails.length; k++) {
                                if (subscription.roleDetails[k] == 'SPOC') {
                                    spoc = subscription.userID;
                                }
                                if (subscription.roleDetails[k] == 'Business Owner') {
                                    businessOwner = subscription.userID;
                                }
                                 if (subscription.roleDetails[k] == 'IT Owner') {
                                    itOwner = subscription.userID;
                                }
                            }
                        }


                        output.push({
                            name: list[i].fullName,
                            description: list[i].description,
                            cobraId: cobras.length ? cobras[0].id : '',
                            cobraName: cobras.length ? cobras[0].name : '',
                            id: list[i].ID,
                            lifecyclePhase: currentLifecycle ? currentLifecycle.phase : '',
                            golive: golive ? golive.startDate : '',
                            retired: retired ? retired.startDate : '',
                            market: market,
                            costCentre: getTagFromGroup(list[i], costCentres),
                            admScope: getTagFromGroup(list[i], 'AD&M Scope') ? 'Yes' : 'No',
                            cotsPackage: getTagFromGroup(list[i], 'COTS Package') ? 'Yes' : 'No',
                            resourceId: resources.length ? resources[0].id : '',
                            resourceName: resources.length ? resources[0].name : '',
                            remedyID: remedy.length ? remedy[0].id : '',
                            remedyName: remedy.length ? remedy[0].name : '',
                            supportID: support.length ? support[0].id : '',
                            supportName: support.length ? support[0].name : '',
                            lastUpgrade: getTagFromGroup(list[i], lastUpgrades),
                            

                            customisation: getTagFromGroup(list[i], customisations),
                            businessValue: list[i].functionalSuitabilityID ? businessValue[list[i].functionalSuitabilityID] : '',
                            technicalCondition: list[i].technicalSuitabilityID ? technicalCondition[list[i].technicalSuitabilityID] : '',
                            complexity: getTagFromGroup(list[i], complexities),
                            businessCriticality: list[i].businessCriticalityID ? businessCriticality[list[i].businessCriticalityID] : '',
                            appType: getTagFromGroup(list[i], appTypes),
                            alias: list[i].alias,
                            pciFlag: getTagFromGroup(list[i], pciFlags),
                            soxFlag: getTagFromGroup(list[i], soxFlags),
                            itOwner: itOwner ? users[itOwner] : '',
                            businessOwner: businessOwner ? users[businessOwner] : '',
                            spoc: spoc ? users[spoc] : '',
                            recommendation: getTagFromGroup(list[i], recommendations),

                        });


                    }
                }


                function link(cell, row) {
                    return '<a href="' + that.reportSetup.baseUrl + '/services/' + row.id + '" target="_blank">' + cell + '</a>';
                }

                function linkResource(cell, row) {
                    if (row.resourceId)
                        return '<a href="' + that.reportSetup.baseUrl + '/resources/' + row.resourceId + '" target="_blank">' + cell + '</a>';
                }

                function linkRemedy(cell, row) {
                    if (row.remedyID)
                        return '<a href="' + that.reportSetup.baseUrl + '/resources/' + row.remedyID + '" target="_blank">' + cell + '</a>';
                }

                function linkSupport(cell, row) {
                    if (row.supportID)
                        return '<a href="' + that.reportSetup.baseUrl + '/resources/' + row.supportID + '" target="_blank">' + cell + '</a>';
                }

                function linkBC(cell, row) {
                    if (row.cobraId)
                        return '<a href="' + that.reportSetup.baseUrl + '/businessCapabilities/' + row.cobraId + '" target="_blank">' + cell + '</a>';
                }

                ReactDOM.render(
                    <div>
                        <BootstrapTable data={output} striped={true} hover={true} search={true} pagination={true} exportCSV={true}>
                            <TableHeaderColumn dataField="id" isKey={true} hidden={true}>ID</TableHeaderColumn>
                            <TableHeaderColumn dataField="name" width="150" dataAlign="left" dataSort={true} dataFormat={link} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Application Name</TableHeaderColumn>
                            <TableHeaderColumn dataField="description" width="150" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Description</TableHeaderColumn>
                            <TableHeaderColumn dataField="cobraName" width="150" dataAlign="left" dataSort={true} dataFormat={linkBC} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>COBRA</TableHeaderColumn>
                            <TableHeaderColumn dataField="lifecyclePhase" width="100" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(lifecycleArray) }}>Phase</TableHeaderColumn>
                            <TableHeaderColumn dataField="golive" width="150" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Go Live Date</TableHeaderColumn>
                            <TableHeaderColumn dataField="retired" width="150" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Retired Date</TableHeaderColumn>
                            <TableHeaderColumn dataField="recommendation" width="100" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(recommendations) }}>Recommendation</TableHeaderColumn>
                            <TableHeaderColumn dataField="market" width="80" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: markets }}>Market</TableHeaderColumn>
                            <TableHeaderColumn dataField="costCentre" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(costCentres) }}>Cost Centre</TableHeaderColumn>
                            <TableHeaderColumn dataField="admScope" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(['Yes', 'No']) }}>In AD&M Scope</TableHeaderColumn>
                            <TableHeaderColumn dataField="cotsPackage" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(['Yes', 'No']) }}>COTS Package</TableHeaderColumn>
                            <TableHeaderColumn dataField="lastUpgrade" width="150" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Last Major Upgrade Date</TableHeaderColumn>
                         
                           
                           
                            <TableHeaderColumn dataField="resourceName" width="150" dataAlign="left" dataSort={true} dataFormat={linkResource} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>COTS Software</TableHeaderColumn>
                           
                           
                            <TableHeaderColumn dataField="remedyName" width="150" dataAlign="left" dataSort={true} dataFormat={linkRemedy} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Remedy Business Service</TableHeaderColumn>
                            <TableHeaderColumn dataField="supportName" width="150" dataAlign="left" dataSort={true} dataFormat={linkSupport} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Supported By</TableHeaderColumn>
                            <TableHeaderColumn dataField="customisation" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(customisations) }}>Level of Customisation</TableHeaderColumn>
                            <TableHeaderColumn dataField="businessValue" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(businessValueOptions) }}>Business Value</TableHeaderColumn>
                            <TableHeaderColumn dataField="technicalCondition" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(technicalConditionOptions) }}>Technical Condition</TableHeaderColumn>
                            <TableHeaderColumn dataField="complexity" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(complexities) }}>Application Complexity</TableHeaderColumn>
                            <TableHeaderColumn dataField="businessCriticality" width="120" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(businessCriticalityOptions) }}>Business Criticality</TableHeaderColumn>
                            <TableHeaderColumn dataField="alias" width="100" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Alternate names</TableHeaderColumn>
                            <TableHeaderColumn dataField="appType" width="100" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(appTypes) }}>App Type</TableHeaderColumn>
                            <TableHeaderColumn dataField="soxFlag" width="100" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(soxFlags) }}>SOX Flag</TableHeaderColumn>
                            <TableHeaderColumn dataField="pciFlag" width="100" dataAlign="left" dataSort={true} filter={{ type: "SelectFilter", options: getLookup(pciFlags) }}>PCI Flag</TableHeaderColumn>
                            <TableHeaderColumn dataField="itOwner" width="100" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>IT Owner</TableHeaderColumn>
                            <TableHeaderColumn dataField="businessOwner" width="100" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>Business Owner</TableHeaderColumn>
                            <TableHeaderColumn dataField="spoc" width="100" dataAlign="left" dataSort={true} filter={{ type: "TextFilter", placeholder: "Please enter a value" }}>SPOC</TableHeaderColumn>


                         

                        </BootstrapTable>
                    </div>,
                    document.getElementById("app")
                );
            });
    };

    return ReportApplicationPortfolio;
})();