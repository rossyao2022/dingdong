/* Browser-facing adapter. Vendor credentials and account identity belong in the CA backend. */
(() => {
  class BackendUnavailable extends Error { constructor(){super('真实接口尚未接入；当前仅支持网页互动演示。');this.code='BACKEND_UNAVAILABLE';} }
  const vendorContract = Object.freeze({
    bind:{method:'POST',path:'/api/v1/ca/account/bind'},
    unbind:{method:'POST',path:'/api/v1/ca/account/unbind'},
    profile:{method:'GET',path:'/api/v1/ca/growth/profile'},
    summary:{method:'GET',path:'/api/v1/ca/growth/summary'},
    trend:{method:'GET',path:'/api/v1/ca/growth/trend'}
  });
  const normalizeScores = data => ['companion','wisdom','growth','action','creativity'].map(key => ({key,value:typeof data?.scores?.[key]==='number' && Number.isFinite(data.scores[key]) ? data.scores[key] : null,version:data?.score_version??null,updatedAt:data?.updated_at??null,source:'dingdong',period:data?.period??null}));
  window.DingDongAPI = Object.freeze({mode:'demo',vendorContract,normalizeScores,async getGrowth(){return {status:'unbound',scores:normalizeScores(null),summary:null,trend:null};},async bind(){throw new BackendUnavailable();},async sendTask(){throw new BackendUnavailable();}});
})();
