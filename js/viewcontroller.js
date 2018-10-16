/**
 * View Controller
 *
 * @author malulleybovo (2018)
 */

class ViewController {
    constructor(assistant) {
        // Immutable variables (properties can still change)
        this.filters = [];
        this.affixesSelected = [];
        this.choicesSelected = [];
        this.assistant = assistant;
        // Make functions immutable
        let funcs = Object.getOwnPropertyNames(ViewController.prototype);
        for (var i = 0; i < funcs.length; i++) {
            let prop = funcs[i];
            if (prop == 'constructor') continue;
            if (typeof this[prop] == 'function') {
                Object.defineProperty(this, prop, {
                    enumerable: true,
                    value: this[prop],
                    writable: false
                });
            }
        }
        // Mutable variables
    }

    setup() {
        $("#editor").children().first().panzoom({
            which: 3,
            minScale: 0.1,
            maxScale: 2,
            onChange: this.updateConnections
        });
        $("#editor").on('wheel', function (e) {
            e.preventDefault();
            var delta = e.delta || e.originalEvent.wheelDelta;
            var zoomOut = delta ? delta < 0 : e.originalEvent.deltaY > 0;
            $("#editor").children().first().panzoom('zoom', zoomOut, {
                increment: 0.1,
                animate: false,
                focal: e
            });
        });
        $('#panzoomreset').click({ viewcontroller: this }, function (e) {
            e.preventDefault();
            e.data.viewcontroller.centerViewAtNode('#goal');
        });
    }

    setActiveFodder(e) {
        let vc = (this instanceof ViewController) ? this :
            (e.data && e.data.viewcontroller) ? e.data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        let found = vc.findFodderAndNodeByDOM(this);
        vc.assistant.setActiveFodder(found.fodder);
        vc.assistant.setActivePageTreeNode(found.pageTreeNode);
        vc.affixesSelected = found.fodder.affixes.slice(0);
        vc.openChoicesSelectionView();
    }

    findFodderAndNodeByDOM(fodderElem) {
        let $elem = $(fodderElem);
        if (!$elem.hasClass('fodder')) $elem = $elem.parents('div.fodder');
        if ($elem.length <= 0 || !(this.assistant.pageTreeRoot instanceof PageTreeNode)) return;
        let indices = [];
        do {
            if ($elem.length > 0) indices.unshift($elem.index());
            $elem = $elem.parents('div.mgrid');
        } while ($elem.length > 0);
        indices.splice(0, 1);
        let curr = this.assistant.pageTreeRoot;
        for (var i = 0; i < indices.length - 1; i++) {
            curr = curr.children[indices[i]];
        }
        let fodder = curr.page.fodders[indices[indices.length - 1]];
        return {
            fodder: fodder,
            pageTreeNode: curr
        };
    }

    setFilters(filters) {
        if (filters && Array.isArray(filters)) {
            this.filters = filters.slice();
        }
        return this;
    }

    setAffixSelectionView(bool) {
        if (typeof bool !== 'boolean') return;
        if ($('div.choice-selection-container').length != 0) {
            $('div.choice-selection-container').remove();
        }
        let isVisible = $('div.affix-selection-container').length != 0;
        if (bool) {
            if (!isVisible) {
                $('body').append(
                    SELECTION_MENU_TEMPLATE({
                        type: 'affixSelection',
                        affixesSelected: this.affixesSelected,
                        categories: this.filters,
                        datalist: this.assistant.data.abilityList // List of all affixes
                    }));
                $('div.affix-selection-container').animate({}, 10, function () {
                    $('div.affix-selection-container').removeClass('hidden');
                });
                $('div.affix-selection-container li > div').click({ viewcontroller: this }, this.selectAbility);
                $('div.affix-selection-container div.affix > i').click({ viewcontroller: this }, this.selectAbility);
                $('div.affix-selection-container div.confirm-button').click({ viewcontroller: this }, function ({ data }) {
                    data.viewcontroller.openChoicesSelectionView();
                    $('div.choice-selection-container div.cancel-button').click({ viewcontroller: data.viewcontroller },
                        ({ data }) => { data.viewcontroller.setAffixSelectionView(true); });
                });
                this.updateAffixSelectionView();
            }
        }
        else {
            if (isVisible) {
                $('div.affix-selection-container').remove();
            }
        }
        return this;
    }

    openChoicesSelectionView(e) {
        if ($('div.affix-selection-container').length != 0) {
            $('div.affix-selection-container').remove();
        }
        let vc = (this instanceof ViewController) ? this :
            (e.data && e.data.viewcontroller) ? e.data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        let choices = vc.assistant.getChoicesForAffixes(vc.affixesSelected);
        if ($('div.choice-selection-container').length != 0) {
            $('div.choice-selection-container').remove();
        }
        vc.choicesSelected.splice(0, vc.choicesSelected.length);
        for (var i = 0; i < vc.affixesSelected.length; i++) {
            vc.choicesSelected.push(null);
        }
        $('body').append(
            SELECTION_MENU_TEMPLATE({
                type: 'choiceSelection',
                affixesSelected: vc.affixesSelected,
                categories: vc.filters,
                datalist: choices
            }));
        $('div.choice-selection-container li > div').click({ viewcontroller: vc }, vc.selectChoice);
        $('div.choice-selection-container div.cancel-button').click(
            (e) => { $('div.choice-selection-container').remove(); });
        $('div.choice-selection-container div.confirm-button').click({ viewcontroller: vc }, vc.produceFodderFromChoices);
    }

    updateView() {
        let vc = (this instanceof ViewController) ? this : (data) ? data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        if (!vc.assistant || !vc.assistant.pageTreeRoot || !(vc.assistant.pageTreeRoot instanceof PageTreeNode)) return;
        $('#mastercontainer').empty().append(PAGE_TREE_NODE_TEMPLATE({
            pageTreeNode: vc.assistant.pageTreeRoot
        }));
        this.regenerateConnections();
        $('div.fodder').hover(spotlightIn, spotlightOut);
        $('div.produce-button').click({ viewcontroller: this }, this.setActiveFodder);
        return this;
    }

    centerViewAtNode(selector) {
        let $node = $(selector);
        if (selector.length <= 0) return;
        let pos = $node.position();
        let $container = $("#editor").children().first();
        let zoomScale = $container.panzoom('getMatrix')[0];
        let toNodeCenter = {
            left: ($node.outerWidth() / 2) + (Math.round(pos.left) / zoomScale),
            top: ($node.outerHeight() / 2) + (Math.round(pos.top) / zoomScale)
        }
        let newpos = {
            left: ($(window).outerWidth() / 2) - toNodeCenter.left
            - (zoomScale - 1) * (toNodeCenter.left - ($container.outerWidth() / 2)),
            top: ($(window).outerHeight() / 2) - toNodeCenter.top
            - (zoomScale - 1) * (toNodeCenter.top - ($container.outerHeight() / 2))
        }
        $container.panzoom('pan', newpos.left, newpos.top, {
            animate: false,
        });
        return this;
    }

    regenerateConnections() {
        let $connectables = $('div[data-conn]');
        // Remove all old connections
        $(`connection`).remove();
        // Generate new connections
        for (var i = 0; i < $connectables.length; i++) {
            let connectableA = $connectables[i];
            for (var j = 0; j < $connectables.length; j++) {
                let connectableB = $connectables[j];
                if (connectableA.dataset.conn == connectableB.dataset.conn
                    && $(connectableA).hasClass('fodder') && $(connectableB).hasClass('page')) {
                    $(connectableA).add(connectableB).connections();
                    $('connection:not([data-conn])').attr('data-conn', connectableA.dataset.conn);
                }
            }
        }
        return this;
    }

    updateConnections() {
        $('div.page, div.fodder').connections('update');
    }

    selectAbility(e) {
        let vc = (this instanceof ViewController) ? this :
            (e.data && e.data.viewcontroller) ? e.data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        if ($(this).hasClass('selected') || $(this).parent().hasClass('affix')) {
            let that = this;
            if ($(this).parent().hasClass('affix')) that = $(this).parent()[0];
            vc.affixesSelected.splice(
                vc.affixesSelected.indexOf(
                    vc.assistant.affixDB[$(that).attr('data-code')].abilityRef
                ), 1
            );
        }
        else {
            let selAffix = vc.assistant.affixDB[$(this).attr('data-code')].abilityRef;
            let hadConflict = false;
            for (var i = 0; i < vc.affixesSelected.length; i++) {
                if (vc.assistant.hasConflict(vc.affixesSelected[i], selAffix)) {
                    vc.affixesSelected[i] = selAffix;
                    hadConflict = true;
                    break;
                }
            }
            if (!hadConflict && vc.affixesSelected.length < 8) {
                vc.affixesSelected.push(vc.assistant.affixDB[$(this).attr('data-code')].abilityRef);
            }
        }
        vc.updateAffixSelectionView();
    }

    selectChoice(e) {
        let vc = (this instanceof ViewController) ? this :
            (e.data && e.data.viewcontroller) ? e.data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        if ($(this).hasClass('selected')) {
            let $divDataCode = $(this).parents('div[data-code]');
            if ($divDataCode.length > 0) {
                let code = $divDataCode.data('code');
                let affix = vc.assistant.affixDB[code];
                if (affix && affix.abilityRef) {
                    let arrIdx = vc.affixesSelected.indexOf(affix.abilityRef);
                    if (arrIdx >= 0 && arrIdx < vc.affixesSelected.length
                        && vc.choicesSelected[arrIdx] !== undefined) {
                        vc.choicesSelected[arrIdx] = null;
                    }
                }
            }
        }
        else {
            let $divDataCode = $(this).parents('div[data-code]');
            if ($divDataCode.length > 0) {
                let code = $divDataCode.data('code');
                let affix = vc.assistant.affixDB[code];
                if (affix && affix.choices && Array.isArray(affix.choices)) {
                    let choices = affix.choices;
                    let choiceIdx = $(this).parent().index();
                    if (choiceIdx >= 0 && choiceIdx < choices.length) {
                        let choice = choices[choiceIdx];
                        let arrIdx = vc.affixesSelected.indexOf(affix.abilityRef);
                        if (arrIdx >= 0 && arrIdx < vc.affixesSelected.length
                            && vc.choicesSelected[arrIdx] !== undefined) {
                            vc.choicesSelected[arrIdx] = choice;
                        }
                    }
                }
            }
        }
        vc.updateChoiceSelectionView();
    }

    produceFodderFromChoices(e) {
        let vc = (this instanceof ViewController) ? this :
            (e.data && e.data.viewcontroller) ? e.data.viewcontroller : undefined;
        if (!(vc instanceof ViewController)) return;
        if (vc.choicesSelected.includes(null)) return;
        let choices = vc.choicesSelected;
        let shouldSpread = false; // TODO allow user to decide
        let targetNumSlots = vc.affixesSelected.length - 1; // TODO allow user to decide N or N-1
        let newPage = vc.assistant.buildPageForChoices(choices, shouldSpread, targetNumSlots);
        if (!newPage) {
            console.warn(
                'Attempted to produce a new page with choices %o, but produced page was %o',
                choices, newPage);
            return;
        }
        // If null, treat it as the root. Otherwise, treat it as a branch node
        if (!vc.assistant.hasActivePageTreeNode()) {
            if (vc.assistant.validateAffixes(vc.affixesSelected)) {
                vc.assistant.setGoal(vc.affixesSelected);
            }
        }
        // Add new page to the tree data structure
        // And connect the produced fodder to the new page
        vc.assistant.updateConnection({
            fodder: vc.assistant.activeFodder,
            page: newPage
        });
        // Update the UI to reflect the data changed
        vc.updateView();
        vc.centerViewAtNode('#goal');
        $('div.choice-selection-container').remove();
    }

    updateAffixSelectionView() {
        $(`div.affix-selection-container li > div`).removeClass('selected');
        let slots = $('div.affix-selection-container div.affix');
        let allStats = {};
        for (var i = 0; i < slots.length; i++) {
            if (this.affixesSelected[i]) {
                $(slots[i]).attr('title', this.affixesSelected[i].effect.replace(/<br>/g, ' '))
                    .attr('data-code', this.affixesSelected[i].code)
                    .removeClass('empty')
                    .find('span').text(this.affixesSelected[i].name);
                $(`div.affix-selection-container li > div[data-code="${this.affixesSelected[i].code}"]`)
                    .addClass('selected');
                let stats = this.affixesSelected[i].effect.split('<br>');
                if (stats.length == 1) stats = stats[0].split(',');
                for (var j = 0; j < stats.length; j++) {
                    let stat = stats[j];
                    if (/(.)*\([\+-][0-9]+\)/.test(stat)) {
                        stat = stat.split('(');
                        let key = stat[0];
                        let value = parseInt(stat[1].slice(0, stat[1].length - 1));
                        if (allStats[key]) {
                            allStats[key] += value;
                        }
                        else {
                            allStats[key] = value;
                        }
                    }
                    else {
                        allStats[stat] = '';
                    }
                }
            }
            else {
                $(slots[i]).attr('title', '')
                    .attr('data-code', '')
                    .addClass('empty')
                    .find('span').html('&nbsp;');
            }
        }
        if (allStats['ALL']) {
            if (allStats['S-ATK']) allStats['S-ATK'] += allStats['ALL'];
            else allStats['S-ATK'] = allStats['ALL'];
            if (allStats['R-ATK']) allStats['R-ATK'] += allStats['ALL'];
            else allStats['R-ATK'] = allStats['ALL'];
            if (allStats['T-ATK']) allStats['T-ATK'] += allStats['ALL'];
            else allStats['T-ATK'] = allStats['ALL'];
            if (allStats['S-DEF']) allStats['S-DEF'] += allStats['ALL'];
            else allStats['S-DEF'] = allStats['ALL'];
            if (allStats['R-DEF']) allStats['R-DEF'] += allStats['ALL'];
            else allStats['R-DEF'] = allStats['ALL'];
            if (allStats['T-DEF']) allStats['T-DEF'] += allStats['ALL'];
            else allStats['T-DEF'] = allStats['ALL'];
            if (allStats['DEX']) allStats['DEX'] += allStats['ALL'];
            else allStats['DEX'] = allStats['ALL'];
            if (allStats['HP']) allStats['HP'] += allStats['ALL'];
            else allStats['HP'] = allStats['ALL'];
            if (allStats['PP']) allStats['PP'] += allStats['ALL'];
            else allStats['PP'] = allStats['ALL'];
            delete allStats['ALL'];
        }
        let statsViewer = $(`div.affix-selection-container div.stats-viewer`);
        if (statsViewer.length > 0) {
            statsViewer.empty();
            for (var key in allStats) {
                let value = allStats[key];
                if (value != '') value = ' (' + ((value >= 0) ? '+' : '') + value + ')';
                statsViewer.append(`<div class="stat">${key + value}</div>`);
            }
        }
    }

    updateChoiceSelectionView() {
        $(`div.choice-selection-container li > div`).removeClass('selected');
        $(`div.choice-selection-container div.affix`).removeClass('selected');
        for (var i = 0; i < this.affixesSelected.length; i++) {
            let choices = this.assistant.affixDB[this.affixesSelected[i].code].choices;
            let choiceIdx = choices.indexOf(this.choicesSelected[i]);
            let optionsList = $(`div.choice-selection-container div[data-code=${this.affixesSelected[i].code}] li > div`);
            if (choiceIdx >= 0 && choiceIdx < optionsList.length) {
                $(optionsList[choiceIdx]).addClass('selected')
                    .parents('div[data-code]').find('div.affix').addClass('selected');
            }
        }
        $(`div.choice-selection-container .confirm-button`).removeClass('disabled');
        if (this.choicesSelected.includes(null)) {
            $(`div.choice-selection-container .confirm-button`).addClass('disabled');
        }
    }
}

var timeout;
function spotlightIn(ev) {
    if (timeout) clearTimeout(timeout);
    let connNum = $(ev.currentTarget).attr('data-conn');
    timeout = setTimeout(function () {
        if (connNum) {
            let $t = $('div[data-conn=' + connNum + ']');
            $('div.page, connection:not([data-conn=' + connNum + '])').not($t).addClass('despotlight');
            $t.addClass('spotlight');
        }
    }, 500);
}

function spotlightOut(ev) {
    if (timeout) clearTimeout(timeout);
    let connNum = $(ev.currentTarget).attr('data-conn');
    if (connNum) {
        let $t = $('div[data-conn=' + connNum + ']');
        $('div.page, connection:not([data-conn=' + connNum + '])').not($t).removeClass('despotlight');
        $t.removeClass('spotlight');
    }
}