const target={ 'test.html':'talents','result.html':'talents','blindbox.html':'explore','island.html':'explore','thumb.html':'fingerprint','report.html':'reports','daily.html':'home' }[location.pathname.split('/').pop()]||'home';
location.replace('./index.html'+location.search+'#'+target);
