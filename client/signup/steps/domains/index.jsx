/**
 * External dependencies
 */
var React = require( 'react' ),
	{ connect } = require( 'react-redux' ),
	defer = require( 'lodash/defer' ),
	page = require( 'page' ),
	i18n = require( 'i18n-calypso' );

/**
 * Internal dependencies
 */
var StepWrapper = require( 'signup/step-wrapper' ),
	productsList = require( 'lib/products-list' )(),
	cartItems = require( 'lib/cart-values' ).cartItems,
	SignupActions = require( 'lib/signup/actions' ),
	MapDomainStep = require( 'components/domains/map-domain-step' ),
	RegisterDomainStep = require( 'components/domains/register-domain-step' ),
	{ DOMAINS_WITH_PLANS_ONLY } = require( 'state/current-user/constants' ),
	{ getSurveyVertical } = require( 'state/signup/steps/survey/selectors.js' ),
	analyticsMixin = require( 'lib/mixins/analytics' ),
	signupUtils = require( 'signup/utils' );

import { getCurrentUser, currentUserHasFlag } from 'state/current-user/selectors';
import Notice from 'components/notice';

const registerDomainAnalytics = analyticsMixin( 'registerDomain' ),
	mapDomainAnalytics = analyticsMixin( 'mapDomain' );

const DomainsStep = React.createClass( {
	showDomainSearch: function() {
		page( signupUtils.getStepUrl( this.props.flowName, this.props.stepName, this.props.locale ) );
	},

	getMapDomainUrl: function() {
		return signupUtils.getStepUrl( this.props.flowName, this.props.stepName, 'mapping', this.props.locale );
	},

	getInitialState: function() {
		return { products: productsList.get() };
	},

	componentDidMount: function() {
		productsList.on( 'change', this.refreshState );
	},

	componentWillUnmount: function() {
		productsList.off( 'change', this.refreshState );
	},

	refreshState: function() {
		this.setState( { products: productsList.get() } );
	},

	handleAddDomain: function( suggestion ) {
		const stepData = {
			stepName: this.props.stepName,
			suggestion
		};

		registerDomainAnalytics.recordEvent( 'addDomainButtonClick', suggestion.domain_name, 'signup' );

		SignupActions.saveSignupStep( stepData );

		defer( () => {
			this.submitWithDomain();
		} );
	},

	isPurchasingTheme: function() {
		return this.props.queryObject && this.props.queryObject.premium;
	},

	getThemeSlug: function() {
		return this.props.queryObject ? this.props.queryObject.theme : undefined;
	},

	getThemeArgs: function() {
		const themeSlug = this.getThemeSlug(),
			themeSlugWithRepo = this.getThemeSlugWithRepo( themeSlug ),
			themeItem = this.isPurchasingTheme()
			? cartItems.themeItem( themeSlug, 'signup-with-theme' )
			: undefined;

		return { themeSlug, themeSlugWithRepo, themeItem };
	},

	getThemeSlugWithRepo: function( themeSlug ) {
		if ( ! themeSlug ) {
			return undefined;
		}
		const repo = this.isPurchasingTheme() ? 'premium' : 'pub';
		return `${repo}/${themeSlug}`;
	},

	submitWithDomain: function( googleAppsCartItem ) {
		const suggestion = this.props.step.suggestion,
			isPurchasingItem = Boolean( suggestion.product_slug ),
			siteUrl = isPurchasingItem
				? suggestion.domain_name
				: suggestion.domain_name.replace( '.wordpress.com', '' ),
			domainItem = isPurchasingItem
				? cartItems.domainRegistration( {
					domain: suggestion.domain_name,
					productSlug: suggestion.product_slug
				} )
				: undefined;

		registerDomainAnalytics.recordEvent( 'submitDomainStepSelection', suggestion, 'signup' );

		SignupActions.submitSignupStep( Object.assign( {
			processingMessage: this.translate( 'Adding your domain' ),
			stepName: this.props.stepName,
			domainItem,
			isDomainOnly: this.props.isDomainOnly ? 1 : 0,
			googleAppsCartItem,
			isPurchasingItem,
			siteUrl,
			stepSectionName: this.props.stepSectionName
		}, this.getThemeArgs() ), [], { domainItem } );

		this.props.goToNextStep();
	},

	handleAddMapping: function( sectionName, domain, state ) {
		const domainItem = cartItems.domainMapping( { domain } );
		const isPurchasingItem = true;

		mapDomainAnalytics.recordEvent( 'addDomainButtonClick', domain, 'signup' );

		SignupActions.submitSignupStep( Object.assign( {
			processingMessage: this.translate( 'Adding your domain mapping' ),
			stepName: this.props.stepName,
			[ sectionName ]: state,
			domainItem,
			isPurchasingItem,
			siteUrl: domain,
			stepSectionName: this.props.stepSectionName
		}, this.getThemeArgs() ) );

		this.props.goToNextStep();
	},

	handleSave: function( sectionName, state ) {
		SignupActions.saveSignupStep( {
			stepName: this.props.stepName,
			stepSectionName: this.props.stepSectionName,
			[ sectionName ]: state
		} );
	},

	domainForm: function() {
		const initialState = this.props.step ? this.props.step.domainForm : this.state.domainForm;
		const includeDotBlogSubdomain = ( this.props.flowName === 'subdomain' );

		return (
			<RegisterDomainStep
				path={ this.props.path }
				initialState={ initialState }
				onAddDomain={ this.handleAddDomain }
				products={ this.state.products }
				basePath={ this.props.path }
				mapDomainUrl={ this.getMapDomainUrl() }
				onAddMapping={ this.handleAddMapping.bind( this, 'domainForm' ) }
				onSave={ this.handleSave.bind( this, 'domainForm' ) }
				offerMappingOption={ ! this.props.isDomainOnly }
				analyticsSection="signup"
				domainsWithPlansOnly={ this.props.domainsWithPlansOnly }
				includeWordPressDotCom={ ! this.props.isDomainOnly }
				includeDotBlogSubdomain={ includeDotBlogSubdomain }
				isSignupStep
				showExampleSuggestions
				surveyVertical={ this.props.surveyVertical }
				suggestion={ this.props.queryObject ? this.props.queryObject.new : '' } />
		);
	},

	mappingForm: function() {
		const initialState = this.props.step ? this.props.step.mappingForm : undefined,
			initialQuery = this.props.step && this.props.step.domainForm && this.props.step.domainForm.lastQuery;

		return (
			<div className="domains-step__section-wrapper">
				<MapDomainStep
					initialState={ initialState }
					path={ this.props.path }
					onRegisterDomain={ this.handleAddDomain }
					onMapDomain={ this.handleAddMapping.bind( this, 'mappingForm' ) }
					onSave={ this.handleSave.bind( this, 'mappingForm' ) }
					products={ productsList.get() }
					domainsWithPlansOnly={ this.props.domainsWithPlansOnly }
					initialQuery={ initialQuery }
					analyticsSection="signup" />
			</div>
		);
	},

	render: function() {
		let content;
		const backUrl = this.props.stepSectionName
			? signupUtils.getStepUrl( this.props.flowName, this.props.stepName, undefined, i18n.getLocaleSlug() )
			: undefined;

		if ( 'mapping' === this.props.stepSectionName ) {
			content = this.mappingForm();
		}

		if ( ! this.props.stepSectionName ) {
			content = this.domainForm();
		}

		if ( this.props.step && 'invalid' === this.props.step.status ) {
			content = (
				<div className="domains-step__section-wrapper">
					<Notice status="is-error" showDismiss={ false }>
						{ this.props.step.errors.message }
					</Notice>
					{ content }
				</div>
			);
		}

		return (
			<StepWrapper
				flowName={ this.props.flowName }
				stepName={ this.props.stepName }
				backUrl={ backUrl }
				positionInFlow={ this.props.positionInFlow }
				signupProgressStore={ this.props.signupProgressStore }
				subHeaderText={ this.translate( 'First up, let\'s find a domain.' ) }
				fallbackHeaderText={ this.translate( 'Let\'s find a domain.' ) }
				fallbackSubHeaderText={ this.translate( 'Choose a custom domain, or a free .wordpress.com address.' ) }
				stepContent={ content } />
		);
	}
} );

module.exports = connect( ( state ) => {
	return {
		// no user = DOMAINS_WITH_PLANS_ONLY
		domainsWithPlansOnly: getCurrentUser( state ) ? currentUserHasFlag( state, DOMAINS_WITH_PLANS_ONLY ) : true,
		surveyVertical: getSurveyVertical( state ),
	};
} ) ( DomainsStep );
