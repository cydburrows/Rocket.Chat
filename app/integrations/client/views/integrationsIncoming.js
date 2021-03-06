import { Meteor } from 'meteor/meteor';
import { ReactiveVar } from 'meteor/reactive-var';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Template } from 'meteor/templating';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';
import { Tracker } from 'meteor/tracker';
import hljs from 'highlight.js';
import toastr from 'toastr';

import { exampleMsg, exampleSettings, exampleUser } from './messageExample';
import { hasAtLeastOnePermission } from '../../../authorization';
import { modal, SideNav } from '../../../ui-utils/client';
import { t, handleError } from '../../../utils';
import { getIntegration } from '../getIntegration';

Template.integrationsIncoming.onCreated(async function _incomingIntegrationsOnCreated() {
	const params = Template.instance().data.params ? Template.instance().data.params() : undefined;
	this.integration = new ReactiveVar({});
	this.record = new ReactiveVar({
		username: 'rocket.cat',
	});
	if (params && params.id) {
		const integration = await getIntegration(params.id, Meteor.userId());
		if (integration) {
			this.integration.set(integration);
		}
	}
});

Template.integrationsIncoming.helpers({
	exampleMsg,
	exampleUser,
	exampleSettings,
	hasPermission() {
		return hasAtLeastOnePermission([
			'manage-incoming-integrations',
			'manage-own-incoming-integrations',
		]);
	},

	canDelete() {
		return this.params && this.params() && typeof this.params().id !== 'undefined';
	},

	data() {
		const data = Template.instance().integration.get();
		if (data) {
			const completeToken = `${ data._id }/${ data.token }`;
			data.url = Meteor.absoluteUrl(`hooks/${ completeToken }`);
			data.completeToken = completeToken;
			data.hasScriptError = data.scriptEnabled && data.scriptError;
			Template.instance().record.set(data);
			return data;
		}

		return Template.instance().record.curValue;
	},
	exampleJson() {
		const record = Template.instance().record.get();
		const data = {
			username: record.alias,
			icon_emoji: record.emoji,
			icon_url: record.avatar,
			text: 'Example message',
			attachments: [{
				title: 'Rocket.Chat',
				title_link: 'https://rocket.chat',
				text: 'Rocket.Chat, the best open source chat',
				image_url: '/images/integration-attachment-example.png',
				color: '#764FA5',
			}],
		};

		const invalidData = [null, ''];
		Object.keys(data).forEach((key) => {
			if (invalidData.includes(data[key])) {
				delete data[key];
			}
		});

		return hljs.highlight('json', JSON.stringify(data, null, 2)).value;
	},

	curl() {
		const record = Template.instance().record.get();

		if (!record.url) {
			return;
		}

		const data = {
			username: record.alias,
			icon_emoji: record.emoji,
			icon_url: record.avatar,
			text: 'Example message',
			attachments: [{
				title: 'Rocket.Chat',
				title_link: 'https://rocket.chat',
				text: 'Rocket.Chat, the best open source chat',
				image_url: '/images/integration-attachment-example.png',
				color: '#764FA5',
			}],
		};

		const invalidData = [null, ''];
		Object.keys(data).forEach((key) => {
			if (invalidData.includes(data[key])) {
				delete data[key];
			}
		});

		return `curl -X POST -H 'Content-Type: application/json' --data '${ JSON.stringify(data) }' ${ record.url }`;
	},

	editorOptions() {
		return {
			lineNumbers: true,
			mode: 'javascript',
			gutters: [
				// 'CodeMirror-lint-markers'
				'CodeMirror-linenumbers',
				'CodeMirror-foldgutter',
			],
			// lint: true,
			foldGutter: true,
			// lineWrapping: true,
			matchBrackets: true,
			autoCloseBrackets: true,
			matchTags: true,
			showTrailingSpace: true,
			highlightSelectionMatches: true,
		};
	},
});

Template.integrationsIncoming.events({
	'blur input': (e, t) => {
		const value = t.record.curValue || {};

		value.name = $('[name=name]').val().trim();
		value.alias = $('[name=alias]').val().trim();
		value.emoji = $('[name=emoji]').val().trim();
		value.avatar = $('[name=avatar]').val().trim();
		value.channel = $('[name=channel]').val().trim();
		value.username = $('[name=username]').val().trim();

		t.record.set(value);
	},

	'click .rc-header__section-button > .delete': () => {
		const params = Template.instance().data.params();

		modal.open({
			title: t('Are_you_sure'),
			text: t('You_will_not_be_able_to_recover'),
			type: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#DD6B55',
			confirmButtonText: t('Yes_delete_it'),
			cancelButtonText: t('Cancel'),
			closeOnConfirm: false,
			html: false,
		}, () => {
			Meteor.call('deleteIncomingIntegration', params.id, (err) => {
				if (err) {
					return handleError(err);
				}
				modal.open({
					title: t('Deleted'),
					text: t('Your_entry_has_been_deleted'),
					type: 'success',
					timer: 1000,
					showConfirmButton: false,
				});

				FlowRouter.go('admin-integrations');
			});
		});
	},

	'click .button-fullscreen': () => {
		const codeMirrorBox = $('.code-mirror-box');
		codeMirrorBox.addClass('code-mirror-box-fullscreen content-background-color');
		codeMirrorBox.find('.CodeMirror')[0].CodeMirror.refresh();
	},

	'click .button-restore': () => {
		const codeMirrorBox = $('.code-mirror-box');
		codeMirrorBox.removeClass('code-mirror-box-fullscreen content-background-color');
		codeMirrorBox.find('.CodeMirror')[0].CodeMirror.refresh();
	},

	'click .rc-header__section-button > .save': () => {
		const enabled = $('[name=enabled]:checked').val().trim();
		const name = $('[name=name]').val().trim();
		const alias = $('[name=alias]').val().trim();
		const emoji = $('[name=emoji]').val().trim();
		const avatar = $('[name=avatar]').val().trim();
		const channel = $('[name=channel]').val().trim();
		const username = $('[name=username]').val().trim();
		const scriptEnabled = $('[name=scriptEnabled]:checked').val().trim();
		const script = $('[name=script]').val().trim();

		if (channel === '') {
			return toastr.error(TAPi18n.__('The_channel_name_is_required'));
		}

		if (username === '') {
			return toastr.error(TAPi18n.__('The_username_is_required'));
		}

		const integration = {
			enabled: enabled === '1',
			channel,
			username,
			alias: alias !== '' ? alias : undefined,
			emoji: emoji !== '' ? emoji : undefined,
			avatar: avatar !== '' ? avatar : undefined,
			name: name !== '' ? name : undefined,
			script: script !== '' ? script : undefined,
			scriptEnabled: scriptEnabled === '1',
		};

		const params = Template.instance().data.params ? Template.instance().data.params() : undefined;
		if (params && params.id) {
			Meteor.call('updateIncomingIntegration', params.id, integration, (err) => {
				if (err) {
					return handleError(err);
				}

				toastr.success(TAPi18n.__('Integration_updated'));
			});
		} else {
			Meteor.call('addIncomingIntegration', integration, (err, data) => {
				if (err) {
					return handleError(err);
				}

				toastr.success(TAPi18n.__('Integration_added'));
				FlowRouter.go('admin-integrations-incoming', { id: data._id });
			});
		}
	},
});

Template.integrationsIncoming.onRendered(() => {
	Tracker.afterFlush(() => {
		SideNav.setFlex('adminFlex');
		SideNav.openFlex();
	});
});
